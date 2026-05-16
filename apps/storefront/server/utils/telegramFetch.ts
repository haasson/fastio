import { fetch, ProxyAgent } from 'undici'

// См. apps/admin/server/utils/telegramFetch.ts — та же логика для storefront.

const proxyUrl = process.env.NUXT_TELEGRAM_PROXY_URL?.trim()
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

if (proxyUrl) {
  console.warn(`[telegramFetch] routing via ${proxyUrl}`)
} else {
  console.warn('[telegramFetch] NUXT_TELEGRAM_PROXY_URL not set — direct fetch (will time out behind RKN block)')
}

export const telegramFetch: typeof fetch = (input, init) =>
  fetch(input, dispatcher ? { ...init, dispatcher } : init)
