import { createError } from 'h3'
import { getAdminClient } from './adminClient'

// Durable per-key rate-limit через RPC `consume_rate_limit` (миграция 264).
// Близнец `apps/storefront/server/utils/enforceRateLimit.ts` — держать
// в актуалке. Вынести в `@fastio/shared` нельзя: оба пакета имеют свой
// admin-client (landing — JWT/service-role с кэшем, storefront — обычный
// service-role через runtime config).
//
// Naming convention для ключей см. docstring в storefront-варианте.
type RateLimitRule = {
  key: string
  max: number
  windowSeconds: number
}

export async function enforceRateLimit(rules: RateLimitRule[], rejectionMessage: string): Promise<void> {
  if (rules.length === 0) return

  const admin = getAdminClient()

  const results = await Promise.all(
    rules.map((rule) =>
      admin.rpc('consume_rate_limit', {
        _key: rule.key,
        _max: rule.max,
        _window_seconds: rule.windowSeconds,
      }),
    ),
  )

  // Fail-closed: при RPC-ошибке отдаём 503 вместо тихого fail-open. См.
  // storefront-вариант docstring. reportError'а тут нет, потому что lanidng
  // — публичный endpoint без Sentry edge wiring; ошибка вылезет на 503 + log.
  for (const { error } of results) {
    if (error) {
      console.error('[enforceRateLimit/landing] consume_rate_limit failed:', error)
      throw createError({ statusCode: 503, message: 'Не удалось проверить лимит. Попробуйте позже.' })
    }
  }

  if (results.some(({ data }) => data === false)) {
    throw createError({ statusCode: 429, message: rejectionMessage })
  }
}
