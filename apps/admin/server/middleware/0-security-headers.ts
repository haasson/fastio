import { randomBytes } from 'node:crypto'
import { defineEventHandler, setResponseHeaders } from 'h3'
import { BASE_SECURITY_HEADERS, buildCsp } from '@fastio/shared'

// Админка позволяет вставлять картинки по произвольному URL (RichTextEditor, image upload), отсюда широкий `https:`.
const IMG_SRC = `'self' data: blob: https:`
const REPORT_URI = 'https://o4511110689980416.ingest.de.sentry.io/api/4511110706561104/security/?sentry_key=a14669efc87ad7295b77cee3cab098b6'

export default defineEventHandler((event) => {
  // В dev отключено: HMR-скрипты Vite/Nuxt бьются о CSP, проще проверять CSP вручную перед релизом.
  if (import.meta.dev) return

  // Per-request nonce, см. storefront/server/middleware/0-security-headers.ts.
  const nonce = randomBytes(18).toString('base64')

  event.context.cspNonce = nonce

  const isApi = event.path?.startsWith('/api/') ?? false

  setResponseHeaders(event, {
    'Content-Security-Policy': buildCsp({ imgSrc: IMG_SRC, nonce, reportUri: REPORT_URI }),
    ...BASE_SECURITY_HEADERS,
    ...(isApi ? {} : { 'Cache-Control': 'private, no-store' }),
  })
})
