import { mapCustomerAddress } from '../../../utils/supabase'
import { getAuthenticatedContext } from '../../../utils/customerAuth'

export default defineEventHandler(async (event) => {
  const { customerId, supabase } = await getAuthenticatedContext(event)
  const addressId = getRouterParam(event, 'id')
  if (!addressId) throw createError({ statusCode: 400 })

  const body = await readBody(event)
  const updates: Record<string, unknown> = {}

  const textFields = ['label', 'address', 'entrance', 'floor', 'apartment', 'intercom', 'comment'] as const
  for (const field of textFields) {
    if (body[field] !== undefined) {
      if (body[field] !== null && typeof body[field] !== 'string') {
        throw createError({ statusCode: 400, message: `Некорректное поле: ${field}` })
      }
      updates[field] = body[field]
    }
  }

  if (body.coordinates !== undefined) {
    const { lat, lng } = body.coordinates
    if (
      typeof lat !== 'number' || typeof lng !== 'number' ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      throw createError({ statusCode: 400, message: 'Некорректные координаты' })
    }
    updates.coordinates = `(${lng},${lat})`
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, message: 'Нечего обновлять' })
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .update(updates)
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .select('*')
    .single()

  if (error || !data) throw createError({ statusCode: 404, message: 'Адрес не найден' })

  return mapCustomerAddress(data)
})
