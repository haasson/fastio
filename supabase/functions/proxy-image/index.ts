import { createClient } from 'npm:@supabase/supabase-js@2'
import { withSentry } from '../_shared/sentry.ts'
import { readBodyWithLimit, resolvesToPublicIp } from './lib.ts'

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
