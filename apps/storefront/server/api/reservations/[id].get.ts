import { mapReservation } from '@fastio/shared'
import { getTenantDb } from '../../utils/tenantDb'
import { getAuthenticatedContext } from '../../utils/customerAuth'

const SELECT_FIELDS = `
  id, tenant_id, branch_id, customer_id,
  guest_name, guest_phone, guest_email, guest_count,
  reserved_date, reserved_time, comment, status,
  table_id, table_name, guest_token,
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

  // IDOR guard (см. apps/storefront/server/api/orders/[id].get.ts)
  const tokenFromQuery = (getQuery(event).t as string | undefined) ?? null
  const resCustomerId = (data as unknown as { customer_id: string | null }).customer_id
  const resGuestToken = (data as unknown as { guest_token: string | null }).guest_token
  let authorized = false

  if (resCustomerId) {
    try {
      const { customerId } = await getAuthenticatedContext(event)

      if (customerId === resCustomerId) authorized = true
    } catch (e: unknown) {
      // 401/404 = норма для guest-flow; реальные ошибки БД пробрасываем.
      const status = (e as { statusCode?: number })?.statusCode
      if (status !== 401 && status !== 404) throw e
    }
  }

  if (!authorized && resGuestToken && tokenFromQuery === resGuestToken) {
    authorized = true
  }

  if (!authorized) throw createError({ statusCode: 404, message: 'Бронь не найдена' })

  return mapReservation(data as unknown as Record<string, unknown>)
})
