const CORS_PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}
const CORS_ORIGIN_HEADER = { 'Access-Control-Allow-Origin': '*' }

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10_000

// Блокируем приватные диапазоны и loopback — основная SSRF-защита
const PRIVATE_HOSTNAME_RE = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local / AWS metadata
  /^0\.0\.0\.0/,
  /^\[?::1\]?$/i,
  /^\[?fc[0-9a-f]{2}:/i, // unique-local IPv6
  /^\[?fe80:/i, // link-local IPv6
]

function validateUrl(raw: string): boolean {
  try {
    const { protocol, hostname } = new URL(raw)
    if (protocol !== 'https:') return false
    const h = hostname.toLowerCase()
    return !PRIVATE_HOSTNAME_RE.some((re) => re.test(h))
  } catch {
    return false
  }
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_ORIGIN_HEADER },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_PREFLIGHT_HEADERS })
  }

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) return jsonError('Missing url parameter', 400)
  if (!validateUrl(url)) return jsonError('URL not allowed', 403)

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok) return jsonError('Failed to fetch image', 502)

    const contentLength = response.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
      return jsonError('Image too large', 413)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) return jsonError('URL does not point to an image', 422)

    const body = await response.arrayBuffer()
    if (body.byteLength > MAX_IMAGE_BYTES) return jsonError('Image too large', 413)

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
})
