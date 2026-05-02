import { getTenantDb } from '../../utils/tenantDb'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const tableId = getRouterParam(event, 'id')
  if (!tableId) throw createError({ statusCode: 400, message: 'Table ID required' })

  const { data, error } = await db
    .from('tables')
    .select('id, name, is_open, is_active')
    .eq('id', tableId)
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
  const { data: tenant } = await db
    .from('tenants')
    .select('modules')
    .single()

  if (!tenant?.modules?.dineIn) {
    throw createError({ statusCode: 400, message: 'Заказ со стола недоступен' })
  }

  return { id: data.id, name: data.name }
})
