import { randomBytes } from 'node:crypto'
import { defineEventHandler, setResponseHeaders } from 'h3'
import { BASE_SECURITY_HEADERS, buildCsp } from '@fastio/shared'

// Витрина: фото товаров/баннеров/галерей в Supabase Storage, аватары Telegram, тайлы Yandex Maps.
const IMG_SRC = `'self' data: blob: https://*.supabase.co https://*.fastio.ru https://t.me https://*.telegram.org https://*.yandex.net https://*.yandex.ru https://api-maps.yandex.ru`
const REPORT_URI = 'https://o4511110689980416.ingest.de.sentry.io/api/4511110692405328/security/?sentry_key=18e41139124871552db25df7db866a49'

export default defineEventHandler((event) => {
  // В dev отключено: HMR-скрипты Vite/Nuxt бьются о CSP, проще проверять CSP вручную перед релизом.
  if (import.meta.dev) return

  // Per-request nonce: 18 random bytes → base64 24 chars ≈ 144 bit entropy
  // (CSP3 рекомендует минимум 128 bit; запас выше предупреждает grinding).
  // Nonce кладём в context, чтобы render:html plugin (csp-nonce.ts) приклеил
  // его ко всем inline-скриптам.
  const nonce = randomBytes(18).toString('base64')

  event.context.cspNonce = nonce

  // Cache-Control: private — защищает от того, что прокси/CDN (Coolify Caddy)
  // закеширует HTML с конкретным nonce и раздаст его другому пользователю,
  // у которого в CSP-заголовке будет уже другой nonce → весь JS заблочится.
  // Применяем только к не-API запросам (страницы, не JSON).
  const isApi = event.path?.startsWith('/api/') ?? false

  setResponseHeaders(event, {
    'Content-Security-Policy': buildCsp({ imgSrc: IMG_SRC, nonce, reportUri: REPORT_URI }),
    ...BASE_SECURITY_HEADERS,
    ...(isApi ? {} : { 'Cache-Control': 'private, no-store' }),
  })
})
