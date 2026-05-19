import { getServerSupabase } from './supabase'

/**
 * Durable per-key rate-limit через RPC `consume_rate_limit` (миграция 264).
 * Принимает массив правил (по IP, по tenant, и т.д.) — все проверяются параллельно
 * и при провале ЛЮБОГО кидается 429 с заданным сообщением.
 *
 * Используется в Telegram-auth endpoints (init/poll/login) и любых других где
 * нужен durable лимит (in-memory от createRateLimiter не годится — не переживёт
 * рестарт и не шарится между инстансами). Для таблиц-вызовов официанта (table-call)
 * используется inline-вариант с возвратом retryAfter клиенту.
 */
type RateLimitRule = {
  key: string
  max: number
  windowSeconds: number
}

export async function enforceRateLimit(rules: RateLimitRule[], rejectionMessage: string): Promise<void> {
  if (rules.length === 0) return

  const admin = getServerSupabase()

  const results = await Promise.all(
    rules.map((rule) =>
      admin.rpc('consume_rate_limit', {
        _key: rule.key,
        _max: rule.max,
        _window_seconds: rule.windowSeconds,
      }),
    ),
  )

  if (results.some(({ data }) => data === false)) {
    throw createError({ statusCode: 429, message: rejectionMessage })
  }
}
