import { fetch, ProxyAgent } from 'undici'
import { useRuntimeConfig } from '#imports'

// VPS в РФ → api.telegram.org заблочен Роскомнадзором по IP. Если задан
// NUXT_TELEGRAM_PROXY_URL (например http://10.0.1.1:1081 → sing-box HTTP inbound),
// все вызовы к Telegram идут через прокси. Без переменной — прямой fetch
// (для локальной разработки или если когда-нибудь снимут блок).
//
// SOCKS не поддерживается — undici.ProxyAgent работает только с HTTP(S) прокси.

type Cached = { dispatcher: ProxyAgent | undefined; warned: boolean }

let cached: Cached | null = null

function getDispatcher(): ProxyAgent | undefined {
  if (cached) return cached.dispatcher

  const proxyUrl = useRuntimeConfig().telegramProxyUrl?.trim()

  cached = {
    dispatcher: proxyUrl ? new ProxyAgent(proxyUrl) : undefined,
    warned: false,
  }

  // Один warn на запуск процесса, не на каждый импорт/вызов. Видно в Coolify
  // logs при cold start если забыли задать env в prod.
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
