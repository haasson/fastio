import { fetch, ProxyAgent } from 'undici'
import { useRuntimeConfig } from '#imports'

// PREPROD-245: единая константа для Telegram Bot API. Хардкод
// `https://api.telegram.org` раскидан по 9+ callsites — при смене на
// зеркало / mock в тестах / прокси-mirror меняется в одном месте.
export const TELEGRAM_API_BASE = 'https://api.telegram.org'

/**
 * Строит URL метода Bot API: `https://api.telegram.org/bot<TOKEN>/<method>`.
 * Использовать вместо `\`${TELEGRAM_API_BASE}/bot${token}/${method}\``, чтобы
 * не плодить опечатки в шаблонах и проще было поменять base в одном месте.
 */
export function telegramApiUrl(token: string, method: string): string {
  return `${TELEGRAM_API_BASE}/bot${token}/${method}`
}

// VPS в РФ → api.telegram.org заблочен Роскомнадзором по IP. Если задан
// NUXT_TELEGRAM_PROXY_URL (например http://host.docker.internal:1081 → sing-box
// HTTP inbound), все вызовы к Telegram идут через прокси. Без переменной —
// прямой fetch (для локальной разработки или если снимут блок).
//
// SOCKS не поддерживается — undici.ProxyAgent работает только с HTTP(S) прокси.
//
// Lazy init на первый вызов: useRuntimeConfig() недоступен на module-load
// до инициализации Nitro. Внутри request handler / nitro-plugin — работает.
// Single-thread Nitro гарантирует, что init выполнится ровно один раз
// (нет await до присвоения cached → нет race).

let cached: { dispatcher: ProxyAgent | undefined } | null = null

function getDispatcher(): ProxyAgent | undefined {
  if (cached) return cached.dispatcher

  const proxyUrl = useRuntimeConfig().telegramProxyUrl?.trim()

  if (proxyUrl) {
    // Видно в Coolify logs при cold-start: подтверждение что прокси активен.
    console.warn(`[telegramFetch] routing via ${proxyUrl}`)
    cached = { dispatcher: new ProxyAgent(proxyUrl) }
  } else {
    // Видно в Coolify logs при cold-start: алерт если забыли задать env в prod.
    console.warn('[telegramFetch] NUXT_TELEGRAM_PROXY_URL not set — direct fetch (will time out behind RKN block)')
    cached = { dispatcher: undefined }
  }

  return cached.dispatcher
}

export const telegramFetch: typeof fetch = (input, init) => {
  const dispatcher = getDispatcher()

  return fetch(input, dispatcher ? { ...init, dispatcher } : init)
}
