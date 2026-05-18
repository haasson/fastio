import { fetch, ProxyAgent } from 'undici'
import { useRuntimeConfig } from '#imports'

// См. apps/admin/server/utils/telegramFetch.ts — та же логика для storefront.

let cached: { dispatcher: ProxyAgent | undefined } | null = null

function getDispatcher(): ProxyAgent | undefined {
  if (cached) return cached.dispatcher

  const proxyUrl = useRuntimeConfig().telegramProxyUrl?.trim()

  if (proxyUrl) {
    console.warn(`[telegramFetch] routing via ${proxyUrl}`)
    cached = { dispatcher: new ProxyAgent(proxyUrl) }
  } else {
    console.warn('[telegramFetch] NUXT_TELEGRAM_PROXY_URL not set — direct fetch (will time out behind RKN block)')
    cached = { dispatcher: undefined }
  }

  return cached.dispatcher
}

export const telegramFetch: typeof fetch = (input, init) => {
  const dispatcher = getDispatcher()

  return fetch(input, dispatcher ? { ...init, dispatcher } : init)
}
