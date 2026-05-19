import { createClient } from '@supabase/supabase-js'
import { captureException, withSentry } from '../_shared/sentry.ts'
import { readBodyWithLimit, resolvesToPublicIp } from './lib.ts'

// Module-scoped клиенты: один экземпляр на весь жизненный цикл воркера.
// anon — для валидации user JWT через auth.getUser(jwt).
// service-role — для consume_rate_limit (GRANT EXECUTE TO service_role в миграции 264).
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
)

const adminSupabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const CORS_PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey',
}
const CORS_ORIGIN_HEADER = { 'Access-Control-Allow-Origin': '*' }

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10_000

// Durable RL (PREPROD-118). Replaces in-memory Map → выживает рестарт воркера и
// шарится между инстансами edge-runtime при горизонтальном масштабировании.
//
// Два scope'а параллельно (см. PREPROD-102 naming convention):
//  • user — основной кап для админа: одна сессия редактирования меню тянет
//    20-50 картинок; 100/min даёт запас, не давая залить кухню бесплатным
//    bandwidth через скомпрометированный токен.
//  • ip — global cap по IP: защита от ботнета с пачкой токенов одного арендатора
//    и от ошибочного фронта, который зацикливает invoke. 300/min покрывает
//    нормальную команду (3-5 операторов за NAT'ом) и режет abuse.
//
// Tenant scope не вводим: endpoint не получает tenantId (admin-side вызов без
// явного контекста аренды). Если потом появится — добавить ключ
// `proxy-image:tenant-ip:<tid>:<ip>` без удаления существующих.
const USER_LIMIT = { max: 100, windowSeconds: 60 }
const IP_LIMIT = { max: 300, windowSeconds: 60 }

function getClientIp(req: Request): string {
  // Приоритет: cf-connecting-ip (Cloudflare, клиент подделать не может) →
  // x-real-ip (Supabase Edge proxy) → x-forwarded-for[0]. Без них — 'unknown'
  // (бакет общий, IP-лимит вырождается в глобальный; per-user продолжает работать).
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf
  const real = req.headers.get('x-real-ip')
  if (real) return real
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown'
  return 'unknown'
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

  // Durable rate-limit (fail-closed): RPC error → 503, иначе один из ключей
  // даст false → 429. Sentry для алерта если RPC ронятся (search_path / DB
  // перегружена / SERVICE_ROLE_KEY ротирован без рестарта воркера).
  const ip = getClientIp(req)
  const [userRes, ipRes] = await Promise.all([
    adminSupabase.rpc('consume_rate_limit', {
      _key: `proxy-image:user:${user.id}`,
      _max: USER_LIMIT.max,
      _window_seconds: USER_LIMIT.windowSeconds,
    }),
    adminSupabase.rpc('consume_rate_limit', {
      _key: `proxy-image:ip:${ip}`,
      _max: IP_LIMIT.max,
      _window_seconds: IP_LIMIT.windowSeconds,
    }),
  ])

  if (userRes.error || ipRes.error) {
    const rpcErr = userRes.error ?? ipRes.error
    console.error('[proxy-image] consume_rate_limit failed:', rpcErr)
    captureException(rpcErr, { fn: 'proxy-image', stage: 'rate-limit' })
    return jsonError('Rate limit unavailable', 503)
  }

  if (userRes.data === false || ipRes.data === false) {
    return jsonError('Too many requests', 429)
  }

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

    return new Response(body.buffer, {
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
