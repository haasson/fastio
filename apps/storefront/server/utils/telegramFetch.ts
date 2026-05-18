import { fetch, ProxyAgent } from 'undici'
import { useRuntimeConfig } from '#imports'

// См. apps/admin/server/utils/telegramFetch.ts — та же логика для storefront.

type Cached = { dispatcher: ProxyAgent | undefined; warned: boolean }

let cached: Cached | null = null

function getDispatcher(): ProxyAgent | undefined {
  if (cached) return cached.dispatcher

  const proxyUrl = useRuntimeConfig().telegramProxyUrl?.trim()

  cached = {
    dispatcher: proxyUrl ? new ProxyAgent(proxyUrl) : undefined,
    warned: false,
  }

  if (!proxyUrl && !cached.warned) {
    console.warn('[telegramFetch] NUXT_TELEGRAM_PROXY_URL not set — direct fetch (will time out behind RKN block)')
    cached.warned = true
  }

  return cached.dispatcher
}

export const telegramFetch: typeof fetch = (input, init) => {
  const dispatcher = getDispatcher()

  return fetch(input, dispatcher ? { ...init, dispatcher } : init)
}
