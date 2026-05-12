import type { H3Event } from 'h3'
import type { Customer } from '@fastio/shared'
import { getAuthSupabase, getServerSupabase, mapCustomer } from './supabase'
import { hashSessionToken, TG_SESSION_COOKIE_NAME } from './telegramAuth'
import { reportError } from '~/shared/utils/reportError'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
// Sliding-renewal threshold: only bump expires_at when the remaining TTL has dropped
// below 29 days, so we make at most one DB write per session per day.
const SLIDING_RENEW_THRESHOLD_MS = 29 * 24 * 60 * 60 * 1000

type AuthContext = {
  customerId: string
  supabase: ReturnType<typeof getServerSupabase | typeof getAuthSupabase>
}

/**
 * Verifies request auth and returns authenticated context.
 *
 * Two paths:
 *   - HttpOnly cookie `tg_session`: Telegram auth, validated against customer_sessions
 *     (token is hashed before lookup; expires_at is slid forward once per day).
 *   - Authorization: Bearer <jwt>: Supabase email/password auth, validated via getUser().
 *
 * Throws 401 if not authenticated, 404 if customer doesn't exist for this tenant.
 */
export async function getAuthenticatedContext(event: H3Event): Promise<AuthContext> {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const cookieToken = getCookie(event, TG_SESSION_COOKIE_NAME)
  if (cookieToken) {
    const supabase = getServerSupabase()
    const session = await resolveTgSession(event, tenantId, cookieToken, supabase)
    return { customerId: session.customer_id, supabase }
  }

  return resolveSupabaseSession(event, tenantId)
}

/**
 * Same as getAuthenticatedContext but also loads the Customer row in a single trip.
 * Use only when the caller actually needs the full profile (e.g. /api/auth/me).
 */
export async function getAuthenticatedContextWithCustomer(
  event: H3Event,
): Promise<AuthContext & { customer: Customer }> {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const cookieToken = getCookie(event, TG_SESSION_COOKIE_NAME)
  if (cookieToken) {
    const supabase = getServerSupabase()
    const session = await resolveTgSession(event, tenantId, cookieToken, supabase)
    const customer = await loadCustomerById(supabase, session.customer_id)
    return { customerId: session.customer_id, supabase, customer }
  }

  const ctx = await resolveSupabaseSession(event, tenantId)
  const customer = await loadCustomerById(ctx.supabase, ctx.customerId)
  return { ...ctx, customer }
}

async function resolveSupabaseSession(event: H3Event, tenantId: string): Promise<AuthContext> {
  const authHeader = getRequestHeader(event, 'authorization')
  if (!authHeader) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const supabase = getAuthSupabase(authHeader)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw createError({ statusCode: 401, message: 'Сессия истекла' })

  const { data: customer, error } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Ошибка базы данных' })
  }
  if (!customer) throw createError({ statusCode: 404, message: 'Профиль не найден' })

  return { customerId: customer.id as string, supabase }
}

type TgSession = { id: string; customer_id: string; tenant_id: string; expires_at: string }

async function resolveTgSession(
  event: H3Event,
  tenantId: string,
  rawToken: string,
  supabase: ReturnType<typeof getServerSupabase>,
): Promise<TgSession> {
  const tokenHash = hashSessionToken(rawToken)

  const { data: session, error } = await supabase
    .from('customer_sessions')
    .select('id, customer_id, tenant_id, expires_at')
    .eq('token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Ошибка базы данных' })
  }
  if (!session) {
    // Token is invalid or expired — clear the cookie so the next request goes to the login flow.
    deleteCookie(event, TG_SESSION_COOKIE_NAME, { path: '/' })
    throw createError({ statusCode: 401, message: 'Сессия истекла' })
  }
  if (session.tenant_id !== tenantId) throw createError({ statusCode: 401, message: 'Сессия недействительна' })

  // Fire-and-forget — the response doesn't depend on the slide. Worst case (a Sentry'd error)
  // is one missed extension, which costs at most one day off the 30-day TTL on next request.
  void slideSessionTtl(supabase, session.id as string, session.expires_at as string)

  return session as TgSession
}

async function loadCustomerById(
  supabase: ReturnType<typeof getServerSupabase | typeof getAuthSupabase>,
  customerId: string,
): Promise<Customer> {
  const { data: row, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .maybeSingle()

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Ошибка базы данных' })
  }
  if (!row) throw createError({ statusCode: 404, message: 'Профиль не найден' })
  return mapCustomer(row)
}

async function slideSessionTtl(
  supabase: ReturnType<typeof getServerSupabase>,
  sessionId: string,
  currentExpiresAt: string,
) {
  const remainingMs = new Date(currentExpiresAt).getTime() - Date.now()
  if (remainingMs > SLIDING_RENEW_THRESHOLD_MS) return

  const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  const { error } = await supabase
    .from('customer_sessions')
    .update({ expires_at: newExpiresAt, last_used_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) reportError(error)
}

export async function getAuthenticatedCustomerId(event: H3Event): Promise<string> {
  const { customerId } = await getAuthenticatedContext(event)
  return customerId
}
