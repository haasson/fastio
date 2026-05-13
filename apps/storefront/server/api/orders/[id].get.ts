import { mapOrder } from '../../utils/supabase'
import { getTenantDb } from '../../utils/tenantDb'
import { getAuthenticatedContext } from '../../utils/customerAuth'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const id = getRouterParam(event, 'id')!

  const { data } = await db
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .maybeSingle()

  if (!data) throw createError({ statusCode: 404, message: 'Заказ не найден' })

  // IDOR guard: либо запрашивающий — owner (customer_id matches auth), либо знает guest_token.
  // 404 (не 403) — чтобы не раскрывать существование заказа.
  const tokenFromQuery = (getQuery(event).t as string | undefined) ?? null
  const orderCustomerId = (data as { customer_id: string | null }).customer_id
  const orderGuestToken = (data as { guest_token: string | null }).guest_token
  let authorized = false

  // Owner-path: пробуем match customer_id. 401/404 = норма для guest-flow,
  // ре-throw'им только реальные ошибки (500 от БД) — иначе Sentry-сигнал теряется.
  if (orderCustomerId) {
    try {
      const { customerId } = await getAuthenticatedContext(event)

      if (customerId === orderCustomerId) authorized = true
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode
      if (status !== 401 && status !== 404) throw e
    }
  }

  // Guest-path: совпадает ли ?t= с заказом. constant-time не нужен (UUID, не секрет dictionary).
  if (!authorized && orderGuestToken && tokenFromQuery === orderGuestToken) {
    authorized = true
  }

  if (!authorized) throw createError({ statusCode: 404, message: 'Заказ не найден' })

  // status — text column (UUID or legacy string), no FK — separate lookup
  let statusInfo: { group_type: string; name: string } | null = null
  if (data.status) {
    const { data: statusRow } = await db
      .from('order_statuses')
      .select('group_type, name')
      .eq('id', data.status)
      .maybeSingle()
    statusInfo = statusRow
  }

  let branchInfo: { address: string | null } | null = null
  if (data.branch_id) {
    const { data: branchRow } = await db.raw
      .from('branches')
      .select('address')
      .eq('id', data.branch_id)
      .maybeSingle()
    branchInfo = branchRow
  }

  return mapOrder({ ...data, _statusInfo: statusInfo, _branchInfo: branchInfo })
})
