import { defineEventHandler, deleteCookie } from 'h3'
import { getAuthenticatedContext } from '../../utils/customerAuth'
import { getTenantDb } from '../../utils/tenantDb'
import { TG_SESSION_COOKIE_NAME } from '../../utils/telegramAuth'
import { reportError } from '@fastio/shared/observability'

/**
 * PREPROD-210: «Выйти со всех устройств».
 *
 * Удаляет ВСЕ `customer_sessions` текущего кастомера в этом тенанте —
 * включая ту, из которой пришёл этот запрос. После DELETE текущая кука
 * `tg_session` указывает на удалённый token_hash → следующий запрос
 * получит 401 в `getAuthenticatedContext`, кука будет вычищена. Здесь
 * сами очищаем кулу заранее чтобы клиент сразу видел разлогин (без
 * лишнего round-trip).
 *
 * Email/password (Supabase) auth тут не трогаем — Supabase SDK сам
 * хранит сессию в localStorage клиента и инвалидируется через
 * `supabase.auth.signOut()` со стороны UI. После PREPROD-099 кастомеры
 * на storefront логинятся ТОЛЬКО через Telegram, поэтому Supabase-ветка
 * — только для legacy сессий.
 */
export default defineEventHandler(async (event) => {
  // Требуем валидную сессию — нельзя revoke если не залогинен.
  const { customerId } = await getAuthenticatedContext(event)
  const db = getTenantDb(event)

  // tenantDb авто-инжектит .eq('tenant_id', tenantId), так что DELETE
  // ограничен текущим тенантом — нельзя случайно вынести сессии того же
  // кастомера в другом тенанте (если такая ситуация возникнет).
  const { error, count } = await db
    .from('customer_sessions')
    .delete({ count: 'exact' })
    .eq('customer_id', customerId)

  if (error) {
    reportError(error, { context: 'revoke-all-sessions', customerId })
    throw createError({ statusCode: 500, message: 'Не удалось отозвать сессии' })
  }

  // Текущая кука теперь невалидна — вычищаем её сразу, чтобы UI после
  // запроса не уходил в редирект через 401 на следующем /api/auth/me.
  deleteCookie(event, TG_SESSION_COOKIE_NAME, { path: '/' })

  return { ok: true, revoked: count ?? 0 }
})
