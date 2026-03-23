import type { H3Event } from 'h3'
import { getAuthSupabase } from './supabase'

/**
 * Verifies request auth and returns authenticated context.
 * Uses anon client with user JWT so RLS policies are enforced on all subsequent queries.
 * Throws 401 if not authenticated, 404 if customer doesn't exist for this tenant.
 */
export async function getAuthenticatedContext(event: H3Event) {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const authHeader = getRequestHeader(event, 'authorization')
  if (!authHeader) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const supabase = getAuthSupabase(authHeader)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw createError({ statusCode: 401, message: 'Сессия истекла' })

  const { data: customer, error } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: 'Ошибка базы данных' })
  if (!customer) throw createError({ statusCode: 404, message: 'Профиль не найден' })

  return { customerId: customer.id as string, supabase }
}

/**
 * Convenience wrapper — returns only the customer ID.
 * Use when you don't need the user-scoped supabase client.
 */
export async function getAuthenticatedCustomerId(event: H3Event): Promise<string> {
  const { customerId } = await getAuthenticatedContext(event)
  return customerId
}
