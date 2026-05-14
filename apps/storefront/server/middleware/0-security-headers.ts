import { defineEventHandler, setResponseHeaders } from 'h3'
import { BASE_SECURITY_HEADERS, buildCsp } from '@fastio/shared'

const CSP = buildCsp({
  // Витрина: фото товаров/баннеров/галерей в Supabase Storage, аватары Telegram, тайлы Yandex Maps.
  imgSrc: `'self' data: blob: https://*.supabase.co https://*.fastio.ru https://t.me https://*.telegram.org https://*.yandex.net https://*.yandex.ru https://api-maps.yandex.ru`,
  reportUri: 'https://o4511110689980416.ingest.de.sentry.io/api/4511110692405328/security/?sentry_key=18e41139124871552db25df7db866a49',
})

export default defineEventHandler((event) => {
  // В dev отключено: HMR-скрипты Vite/Nuxt бьются о CSP, проще проверять CSP вручную перед релизом.
  if (import.meta.dev) return

  setResponseHeaders(event, {
    'Content-Security-Policy': CSP,
    ...BASE_SECURITY_HEADERS,
  })
})
