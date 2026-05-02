import { mapOrder } from '../../utils/supabase'
import { getTenantDb } from '../../utils/tenantDb'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const id = getRouterParam(event, 'id')!

  const { data } = await db
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .maybeSingle()

  if (!data) throw createError({ statusCode: 404, message: 'Заказ не найден' })

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
