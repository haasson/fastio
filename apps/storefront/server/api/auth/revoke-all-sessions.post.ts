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
 * `tg_session` указывает на удалённый token_hash. Здесь сами очищаем куку,
 * чтобы при SSR-рендере '/' после редиректа не было лишнего 401 в request'е.
 *
 * UI после успешного revoke вызывает authStore.logout() — он дёргает
 * /api/auth/logout (no-op без cookie) и supabase.auth.signOut() для legacy
 * Supabase сессий. После PREPROD-099 storefront-кастомеры логинятся только
 * через Telegram, signOut нужен только для пользователей с legacy-сессиями.
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
