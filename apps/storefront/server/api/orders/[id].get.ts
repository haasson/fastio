import { getServerSupabase, mapOrder } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const id = getRouterParam(event, 'id')!
  const supabase = getServerSupabase()

  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data) throw createError({ statusCode: 404, message: 'Заказ не найден' })

  // status — text column (UUID or legacy string), no FK — separate lookup
  let statusInfo: { group_type: string; name: string } | null = null
  if (data.status) {
    const { data: statusRow } = await supabase
      .from('order_statuses')
      .select('group_type, name')
      .eq('id', data.status)
      .maybeSingle()
    statusInfo = statusRow
  }

  let branchInfo: { address: string | null } | null = null
  if (data.branch_id) {
    const { data: branchRow } = await supabase
      .from('branches')
      .select('address')
      .eq('id', data.branch_id)
      .maybeSingle()
    branchInfo = branchRow
  }

  return mapOrder({ ...data, _statusInfo: statusInfo, _branchInfo: branchInfo })
})
