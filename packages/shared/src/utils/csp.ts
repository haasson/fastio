export type CspOptions = {
  imgSrc: string
  /**
   * Per-request nonce для inline-скриптов. Если задан — script-src получает
   * `'nonce-XXX' 'strict-dynamic'`. Без nonce (например в dev/edge case)
   * fallback на старое поведение с host-whitelist'ом.
   */
  nonce?: string
  reportUri?: string
  /**
   * URL Supabase (из runtimeConfig). Его origin + ws-вариант добавляются в
   * connect-src — иначе SPA-клиент не сможет ходить в Supabase (auth/realtime).
   * Захардкоженный db.fastio.ru — прод-дефолт; без этого параметра CSP режет
   * любой не-prod Supabase (локальный 127.0.0.1:54321, staging).
   */
  supabaseUrl?: string
}

// origin + websocket-вариант для connect-src. https→wss, http→ws.
function supabaseConnectSources(url: string): string[] {
  try {
    const u = new URL(url)
    const wsScheme = u.protocol === 'https:' ? 'wss:' : 'ws:'

    return [u.origin, `${wsScheme}//${u.host}`]
  } catch {
    return []
  }
}

export function buildCsp(opts: CspOptions): string {
  // CSP3 поведение, которое мы эксплуатируем:
  //   1. `'unsafe-inline'` игнорируется браузером когда в директиве есть
  //      `nonce-XXX` (или hash-source). Спасает legacy CSP2-браузеры от
  //      слома (там nonce неизвестен → fallback на 'unsafe-inline').
  //   2. Host-source `https:` игнорируется когда есть `'strict-dynamic'`.
  //      Спасает легаси-браузеры от слома (там strict-dynamic неизвестен →
  //      fallback на host-allowlist `https:`).
  // В современных браузерах эффективная policy = "'nonce-XXX' 'strict-dynamic'",
  // в Safari iOS ≤15.3 — degraded protection (открытый `https:`+`unsafe-inline`).
  // Это компромисс ради совместимости; убрать fallback можно когда iOS 15 уйдёт
  // в маргинал (<0.5% траффика).
  const scriptSrc = opts.nonce
    ? `script-src 'self' 'unsafe-inline' 'nonce-${opts.nonce}' 'strict-dynamic' https:`
    : `script-src 'self' 'unsafe-inline' https://oauth.telegram.org https://telegram.org https://api-maps.yandex.ru https://*.yandex.ru https://*.yandex.net https://yastatic.net`

  const connectSrc = [
    `'self'`, 'blob:',
    'https://db.fastio.ru', 'wss://db.fastio.ru',
    ...(opts.supabaseUrl ? supabaseConnectSources(opts.supabaseUrl) : []),
    'https://*.ingest.de.sentry.io',
    'https://api-maps.yandex.ru', 'https://*.yandex.ru', 'https://*.yandex.net', 'https://yastatic.net',
    'https://suggestions.dadata.ru', 'https://oauth.telegram.org',
  ].join(' ')

  const directives = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src ${opts.imgSrc}`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `connect-src ${connectSrc}`,
    `frame-src 'self' https://oauth.telegram.org https://*.yandex.ru https://*.yandex.net`,
    // data: нужен для Yandex Maps v3 — vector renderer создаёт web-worker из inline data:application/javascript.
    `worker-src 'self' blob: data:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
    'upgrade-insecure-requests',
  ]
  if (opts.reportUri) directives.push(`report-uri ${opts.reportUri}`)
  return directives.join('; ')
}

export const BASE_SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

/**
 * Регекс для приклеивания CSP-nonce ко всем `<script>` без атрибута `nonce`.
 * Используется в Nitro `render:html` hook'ах storefront/admin.
 *
 * Negative lookahead `(?![^>]*\snonce=)` пропускает теги, у которых nonce уже есть
 * (например inline-скрипт, который сам разработчик пометил вручную).
 *
 * Известное ограничение: regex'ом нельзя надёжно отличить `<script>` как тег
 * от `<script>` как текста внутри атрибута (например `<div data-x="<script>...">`).
 * В FastIO такой пейлоад появиться может только через `v-html` без `useSafeHtml`
 * — текущая конвенция требует sanitize все `v-html`, поэтому риска нет. См.
 * TECHDEBT.md если потребуется ужесточить.
 */
export function buildNonceInjector(nonce: string): (chunk: string) => string {
  return (chunk: string) => chunk.replace(/<script(?![^>]*\snonce=)/gi, `<script nonce="${nonce}"`)
}
