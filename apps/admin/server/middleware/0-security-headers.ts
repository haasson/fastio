import { defineEventHandler, setResponseHeaders } from 'h3'
import { BASE_SECURITY_HEADERS, buildCsp } from '@fastio/shared'

const CSP = buildCsp({
  // Админка позволяет вставлять картинки по произвольному URL (RichTextEditor, image upload), отсюда широкий `https:`.
  imgSrc: `'self' data: blob: https:`,
  reportUri: 'https://o4511110689980416.ingest.de.sentry.io/api/4511110706561104/security/?sentry_key=a14669efc87ad7295b77cee3cab098b6',
})

export default defineEventHandler((event) => {
  // В dev отключено: HMR-скрипты Vite/Nuxt бьются о CSP, проще проверять CSP вручную перед релизом.
  if (import.meta.dev) return

  setResponseHeaders(event, {
    'Content-Security-Policy': CSP,
    ...BASE_SECURITY_HEADERS,
  })
})
