import { getServerSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const tableId = getRouterParam(event, 'id')
  if (!tableId) throw createError({ statusCode: 400, message: 'Table ID required' })

  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('tables')
    .select('id, name, is_open, is_active')
    .eq('id', tableId)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) {
    throw createError({ statusCode: 404, message: 'Стол не найден' })
  }

  if (!data.is_active) {
    throw createError({ statusCode: 404, message: 'Стол не найден' })
  }

  if (!data.is_open) {
    throw createError({ statusCode: 400, message: 'Стол сейчас не обслуживается' })
  }

  // Проверяем что dineIn модуль включён
  const { data: tenant } = await supabase
    .from('tenants')
    .select('modules')
    .eq('id', tenantId)
    .single()

  if (!tenant?.modules?.dineIn) {
    throw createError({ statusCode: 400, message: 'Заказ со стола недоступен' })
  }

  return { id: data.id, name: data.name }
})
