import { getTenantDb } from '../../utils/tenantDb'
import { mapAppointment } from '@fastio/shared'
import { getAuthenticatedContextWithCustomer } from '../../utils/customerAuth'

export default defineEventHandler(async (event) => {
  // Supports both Bearer JWT (Supabase email/password) and Telegram cookie
  // sessions. Ownership filter uses customer_id — durable across phone
  // changes, immune to phone collisions between strangers.
  const db = getTenantDb(event)

  const { customer } = await getAuthenticatedContextWithCustomer(event)
  // Cookie/JWT от другого тенанта на этом домене — не показываем чужие записи.
  if (customer.tenantId !== db.tenantId) throw createError({ statusCode: 403 })

  const { data } = await db
    .from('appointments')
    .select(`
      id, tenant_id, branch_id, service_id, service_name, service_price, resource_id, user_id, customer_id,
      customer_name, customer_phone,
      starts_at, ends_at, actual_ends_at, status, notes,
      cancel_reason, cancelled_by, cancelled_at,
      confirmed_at, confirmed_by, created_at, updated_at,
      allow_reschedule_snapshot, allow_cancel_snapshot,
      resources(name)
    `)
    .eq('customer_id', customer.id)
    .order('starts_at', { ascending: false })
    .limit(50)

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...mapAppointment(row),
    resourceName: ((row.resources as { name: string } | null))?.name ?? null,
  }))
})
