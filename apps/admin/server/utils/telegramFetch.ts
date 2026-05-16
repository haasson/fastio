import { fetch, ProxyAgent } from 'undici'

// VPS в РФ → api.telegram.org заблочен Роскомнадзором по IP. Если задан
// NUXT_TELEGRAM_PROXY_URL (например http://10.0.1.1:1081 → sing-box HTTP inbound),
// все вызовы к Telegram идут через прокси. Без переменной — прямой fetch
// (для локальной разработки или если когда-нибудь снимут блок).
//
// SOCKS не поддерживается — undici.ProxyAgent работает только с HTTP(S) прокси.

const proxyUrl = process.env.NUXT_TELEGRAM_PROXY_URL?.trim()
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

if (proxyUrl) {
  console.warn(`[telegramFetch] routing via ${proxyUrl}`)
} else {
  console.warn('[telegramFetch] NUXT_TELEGRAM_PROXY_URL not set — direct fetch (will time out behind RKN block)')
}

export const telegramFetch: typeof fetch = (input, init) => fetch(input, dispatcher ? { ...init, dispatcher } : init)
