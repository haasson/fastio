import { mapOrder } from '../../utils/supabase'
import { getTenantDb } from '../../utils/tenantDb'
import { getAuthenticatedCustomerId } from '../../utils/customerAuth'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const customerId = await getAuthenticatedCustomerId(event)

  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 20))
  const offset = (page - 1) * limit

  const { data, error, count } = await db
    .from('orders')
    .select('*, order_items(*)', { count: 'exact' })
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw createError({ statusCode: 500, message: error.message })

  // status is a text column without FK — resolve names via separate lookup
  const statusIds = [...new Set((data ?? []).map((o) => o.status).filter(Boolean))]
  const statusMap: Record<string, { name: string; group_type: string }> = {}
  if (statusIds.length) {
    const { data: statuses } = await db
      .from('order_statuses')
      .select('id, name, group_type')
      .in('id', statusIds)
    for (const s of statuses ?? []) statusMap[s.id] = s
  }

  const orders = (data ?? []).map((row) => mapOrder({ ...row, _statusInfo: statusMap[row.status] ?? null }))

  return {
    orders,
    total: count ?? 0,
    page,
    limit,
  }
})
