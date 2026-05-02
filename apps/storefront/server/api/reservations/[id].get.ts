import { mapReservation } from '@fastio/shared'
import { getTenantDb } from '../../utils/tenantDb'

const SELECT_FIELDS = `
  id, tenant_id, branch_id, customer_id,
  guest_name, guest_phone, guest_email, guest_count,
  reserved_date, reserved_time, comment, status,
  table_id, table_name,
  confirmed_by, confirmed_at, seated_at,
  cancelled_at, cancel_reason,
  created_at, updated_at
`.trim()

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400 })

  const { data, error } = await db
    .from('reservations')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!data) throw createError({ statusCode: 404, message: 'Бронь не найдена' })

  return mapReservation(data as unknown as Record<string, unknown>)
})
