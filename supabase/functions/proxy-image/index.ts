import { createClient } from 'npm:@supabase/supabase-js@2'
import { withSentry } from '../_shared/sentry.ts'

// Module-scoped клиент: один на весь жизненный цикл инстанса.
// Per-request передаём JWT в auth.getUser(jwt) — это валидирует токен серверно.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
)

const CORS_PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey',
}
const CORS_ORIGIN_HEADER = { 'Access-Control-Allow-Origin': '*' }

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10_000
const RATE_LIMIT_MAX = 10 // запросов
const RATE_LIMIT_WINDOW_MS = 60_000 // в минуту

// SSRF-защита: фильтруем результат DNS-резолва, а не сам hostname (DNS rebinding обходит host-check).
// Между нашим resolveDns и fetch'ом Deno делает свой резолв — это TOCTOU race, но без low-level
// контроля над сокетом в Deno edge runtime закрыть его нельзя; принят как known risk.
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // link-local + cloud metadata (AWS/GCP/Azure)
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && (b === 0 || b === 168)) return true
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast + reserved
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fe80:') || lower.startsWith('fec0:')) return true // link-local + deprecated site-local
  if (/^f[cd]/.test(lower)) return true // unique-local (fc00::/7)
  if (lower.startsWith('ff')) return true // multicast
  if (lower.startsWith('64:ff9b:')) return true // NAT64
  if (lower.startsWith('100::')) return true // discard prefix
  if (lower.startsWith('2001:db8:')) return true // documentation
  if (lower.startsWith('2001:0:') || lower.startsWith('2001::')) return true // Teredo
  if (lower.startsWith('2002:')) return true // 6to4 (deprecated)
  const mapped = lower.match(/^::ffff:([\d.]+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  return false
}

async function resolvesToPublicIp(hostname: string): Promise<boolean> {
  // IPv4 в decimal/hex/octal формах (2130706433, 0x7f000001) сюда не попадают —
  // их Deno.resolveDns ниже отвергнет как невалидный hostname → fail-closed.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return !isPrivateIPv4(hostname)
  if (hostname.includes(':')) return !isPrivateIPv6(hostname)

  try {
    const [a, aaaa] = await Promise.all([
      Deno.resolveDns(hostname, 'A').catch(() => [] as string[]),
      Deno.resolveDns(hostname, 'AAAA').catch(() => [] as string[]),
    ])
    if (a.length === 0 && aaaa.length === 0) return false
    if (a.some((ip) => isPrivateIPv4(ip))) return false
    if (aaaa.some((ip) => isPrivateIPv6(ip))) return false
    return true
  } catch {
    return false // fail closed
  }
}

// Per-user in-memory rate limit. Не идеален при множественных инстансах edge runtime,
// но базовая защита от спама в рамках одного инстанса работает.
const rateBuckets = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const hits = (rateBuckets.get(userId) ?? []).filter((t) => t > cutoff)
  if (hits.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(userId, hits)
    return false
  }
  hits.push(now)
  rateBuckets.set(userId, hits)
  // Чистим записи, у которых ВСЕ хиты протухли, чтобы Map не рос неограниченно
  // по уникальным userId при длительной жизни инстанса
  if (rateBuckets.size > 256) {
    for (const [k, v] of rateBuckets) {
      if (v.length === 0 || v[v.length - 1] <= cutoff) rateBuckets.delete(k)
    }
  }
  return true
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_ORIGIN_HEADER },
  })
}

// Стрим-based чтение body с early-abort при превышении лимита — не выделяем 10MB+ если ответ большой.
async function readBodyWithLimit(response: Response, limit: number): Promise<Uint8Array | null> {
  const reader = response.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let received = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue
      received += value.byteLength
      if (received > limit) {
        await reader.cancel()
        return null // превышен лимит
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const merged = new Uint8Array(received)
  let offset = 0
  for (const c of chunks) { merged.set(c, offset); offset += c.byteLength }
  return merged
}

Deno.serve(withSentry('proxy-image', async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_PREFLIGHT_HEADERS })
  }

  if (req.method !== 'POST') return jsonError('Method Not Allowed', 405)

  // Авторизация — только authenticated user (anon JWT и публичные ключи отклоняются)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return jsonError('Unauthorized', 401)

  const jwt = authHeader.slice('Bearer '.length)
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) return jsonError('Unauthorized', 401)

  if (!checkRateLimit(user.id)) return jsonError('Too many requests', 429)

  let url: unknown
  try { ({ url } = await req.json()) }
  catch { return jsonError('Invalid JSON body', 400) }
  if (typeof url !== 'string' || !url) return jsonError('Missing url parameter', 400)

  let parsed: URL
  try { parsed = new URL(url) }
  catch { return jsonError('URL not allowed', 403) }
  if (parsed.protocol !== 'https:') return jsonError('URL not allowed', 403)

  if (!(await resolvesToPublicIp(parsed.hostname))) return jsonError('URL not allowed', 403)

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)' },
      // Запрет редиректов: 3xx на http://internal обошёл бы наш IP-чек
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok) return jsonError('Failed to fetch image', 502)

    const contentLength = response.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
      return jsonError('Image too large', 413)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) return jsonError('URL does not point to an image', 422)

    const body = await readBodyWithLimit(response, MAX_IMAGE_BYTES)
    if (!body) return jsonError('Image too large', 413)

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        ...CORS_ORIGIN_HEADER,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') return jsonError('Request timed out', 504)
    return jsonError('Failed to fetch', 500)
  }
}))
