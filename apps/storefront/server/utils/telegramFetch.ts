import { fetch, ProxyAgent } from 'undici'
import { useRuntimeConfig } from '#imports'

// См. apps/admin/server/utils/telegramFetch.ts — та же логика для storefront.

// PREPROD-245: единая константа для Telegram Bot API. Симметрично admin.
export const TELEGRAM_API_BASE = 'https://api.telegram.org'

export function telegramApiUrl(token: string, method: string): string {
  return `${TELEGRAM_API_BASE}/bot${token}/${method}`
}

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
