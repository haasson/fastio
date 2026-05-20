import { getServerSupabase } from './supabase'
import { reportError } from '@fastio/shared/observability'

/**
 * Durable per-key rate-limit через RPC `consume_rate_limit` (миграция 264).
 * Принимает массив правил (например, per-IP-global + per-(tenant,IP)) — все
 * проверяются параллельно, при провале ЛЮБОГО кидается 429.
 *
 * Единственный rate-limit для storefront-server'а после PREPROD-102:
 * выживает рестарт Nitro, шарится между инстансами при горизонтальном
 * масштабировании. Для table-call используется inline-вариант с возвратом
 * `retryAfter` клиенту (UI цепляет cooldown к кнопке).
 *
 * **Latency:** каждый вызов = 1 RPC round-trip к Postgres (~5-50ms на
 * прогретой БД). Если правил несколько, идут параллельно → одна RTT.
 *
 * **Naming convention** для ключей:
 *   - `<endpoint>:ip:<ip>` — global per-IP cap
 *   - `<endpoint>:tenant-ip:<tenantId>:<ip>` — per-(tenant, IP)
 *   - `<endpoint>:1m:<scope>:...` / `:12h:<scope>:...` — окно в суффиксе если важно
 *   - `<endpoint>:user:<userId>` / `:email:<email>` — auth/email scope
 * Если у тебя scope один (per-IP только) — окно не суффиксируем.
 *
 * **SYNC:** держать в актуалке с `apps/landing/server/utils/enforceRateLimit.ts`.
 * Вынести в `@fastio/shared` нельзя — оба пакета имеют свой admin-client
 * (storefront → `getServerSupabase`, landing → `getAdminClient` с JWK/JWT).
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

  // Fail-closed на RPC-ошибке: лучше отдать 503 чем пропустить запрос мимо RL.
  // JWT expired / search_path / БД перегружена — всё это должно ронять запрос,
  // а не молча выключать защиту. reportError для алерта в Sentry.
  for (const { error } of results) {
    if (error) {
      reportError(error)
      throw createError({ statusCode: 503, message: 'Не удалось проверить лимит. Попробуйте позже.' })
    }
  }

  if (results.some(({ data }) => data === false)) {
    throw createError({ statusCode: 429, message: rejectionMessage })
  }
}
