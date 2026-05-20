import { getTenantDb } from '../../utils/tenantDb'
import { getAuthenticatedContextWithCustomer } from '../../utils/customerAuth'
import { mapReservation } from '@fastio/shared'
import type { Reservation } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'

export default defineEventHandler(async (event): Promise<Reservation[]> => {
  // Same auth-pattern как в customer/appointments.get.ts: поддерживаем Bearer JWT
  // (Supabase email/password) и tg_session cookie. customerAuth уже загружает
  // customer'а с .eq('tenant_id', event.context.tenantId) → проверка ниже
  // defense-in-depth на случай если customerAuth-логика поменяется.
  const db = getTenantDb(event)
  const { customer } = await getAuthenticatedContextWithCustomer(event)

  if (customer.tenantId !== db.tenantId) throw createError({ statusCode: 403 })

  const { data, error } = await db
    .from('reservations')
    .select(
      'id, tenant_id, branch_id, customer_id, guest_name, guest_phone, guest_email, guest_count, ' +
      'reserved_date, reserved_time, comment, status, table_id, table_name, ' +
      'confirmed_by, confirmed_at, seated_at, completed_at, cancelled_at, cancel_reason, ' +
      'allow_cancel_snapshot, created_at, updated_at',
    )
    .eq('customer_id', customer.id)
    .order('reserved_date', { ascending: false })
    .order('reserved_time', { ascending: false })
    .limit(50)
    .returns<Record<string, unknown>[]>()

  if (error) {
    reportError(error, { context: 'customer-reservations.get', customerId: customer.id, tenantId: db.tenantId })
    throw createError({ statusCode: 500, message: 'Не удалось загрузить брони' })
  }

  return (data ?? []).map((row) => mapReservation(row))
})
