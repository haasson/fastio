import { getServerSupabase, mapCustomer } from './supabase'
import type { Customer } from '@fastio/shared'

/**
 * Ensures a customer record exists for the given auth user in the given tenant.
 * Creates one if it doesn't exist, pulling name/email from auth metadata.
 */
export async function ensureCustomer(
  tenantId: string,
  authUserId: string,
  meta?: { name?: string; email?: string; avatarUrl?: string },
): Promise<Customer> {
  const supabase = getServerSupabase()

  // Check if customer exists
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (existing) return mapCustomer(existing)

  // Create new customer
  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      tenant_id: tenantId,
      auth_user_id: authUserId,
      name: meta?.name ?? null,
      email: meta?.email ?? null,
      avatar_url: meta?.avatarUrl ?? null,
    })
    .select('*')
    .single()

  if (error) {
    // Unique constraint violation — concurrent request already created the record
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('auth_user_id', authUserId)
        .single()
      if (existing) return mapCustomer(existing)
    }
    throw createError({ statusCode: 500, message: 'Не удалось создать профиль клиента' })
  }

  return mapCustomer(created!)
}
