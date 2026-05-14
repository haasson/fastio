export type CspOptions = {
  imgSrc: string
  reportUri?: string
}

export function buildCsp(opts: CspOptions): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' https://oauth.telegram.org https://telegram.org https://api-maps.yandex.ru https://*.yandex.ru https://*.yandex.net`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src ${opts.imgSrc}`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.de.sentry.io https://api-maps.yandex.ru https://*.yandex.ru https://*.yandex.net https://suggestions.dadata.ru https://oauth.telegram.org`,
    `frame-src 'self' https://oauth.telegram.org https://*.yandex.ru https://*.yandex.net`,
    `worker-src 'self' blob:`,
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
