import { getServerSupabase, mapOrder } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const id = getRouterParam(event, 'id')!
  const supabase = getServerSupabase()

  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data) throw createError({ statusCode: 404, message: 'Заказ не найден' })

  return mapOrder(data)
})
