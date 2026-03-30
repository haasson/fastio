import { getServerSupabase } from '../../utils/supabase'
import { mapReservation } from '@fastio/shared'

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
  const tenantId = event.context.tenantId as string | undefined

  if (!tenantId) throw createError({ statusCode: 404 })

  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400 })

  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('reservations')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!data) throw createError({ statusCode: 404, message: 'Бронь не найдена' })

  return mapReservation(data as unknown as Record<string, unknown>)
})
