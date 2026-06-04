import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthSupabase } from '../utils/supabase'
import { hashSessionToken, TG_SESSION_COOKIE_NAME } from '../utils/telegramAuth'
import { reportError } from '@fastio/shared/observability'

export type ResolvedCustomer = {
  customerId: string | null
  authUserId: string | null
}

// Резолвит клиента для атрибуции заказа. Cookie-first, как read-эндпоинты
// (getAuthenticatedContext): сначала tg_session, потом Supabase Bearer. Гость,
// если ни того ни другого. Не бросает — guest fallback.
//
// PREPROD-099: после перехода на TG-only auth у залогиненных клиентов нет
// Supabase-сессии, только httpOnly cookie tg_session. Раньше путь записи читал
// только Bearer → заказы tg-клиентов писались гостевыми (customer_id=null) и не
// попадали в историю кабинета.
export async function resolveCustomer(
  event: H3Event,
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ResolvedCustomer> {
  // Основной путь: tg_session cookie.
  const cookieToken = getCookie(event, TG_SESSION_COOKIE_NAME)
  if (cookieToken) {
    try {
      const tokenHash = hashSessionToken(cookieToken)
      const { data: session, error } = await supabase
        .from('customer_sessions')
        .select('customer_id, tenant_id, expires_at')
        .eq('token_hash', tokenHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (error) reportError(error, { context: 'resolveCustomer:tgSession' })
      if (session && session.tenant_id === tenantId) {
        return { customerId: session.customer_id as string, authUserId: null }
      }
    }
    catch (e) {
      reportError(e, { context: 'resolveCustomer:tgSession' })
      // не валим заказ — падаем в гостя
    }
  }

  // Legacy / future OAuth: Supabase Bearer.
  const authHeader = getRequestHeader(event, 'authorization')
  if (!authHeader) {
    return { customerId: null, authUserId: null }
  }

  try {
    const authClient = getAuthSupabase(authHeader)
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return { customerId: null, authUserId: null }
    }

    const { data: customerData } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    return {
      customerId: customerData?.id as string ?? null,
      authUserId: user.id,
    }
  }
  catch {
    return { customerId: null, authUserId: null }
  }
}
