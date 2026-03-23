import { mapCustomer } from '../../utils/supabase'
import { getAuthenticatedContext } from '../../utils/customerAuth'

export default defineEventHandler(async (event) => {
  const { customerId, supabase } = await getAuthenticatedContext(event)
  const body = await readBody(event)

  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') throw createError({ statusCode: 400, message: 'Некорректное имя' })
    updates.name = body.name.trim()
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string') throw createError({ statusCode: 400, message: 'Некорректный телефон' })
    updates.phone = body.phone.trim()
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, message: 'Нечего обновлять' })
  }

  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', customerId)
    .select('*')
    .single()

  if (error || !data) throw createError({ statusCode: 500, message: 'Не удалось обновить профиль' })

  return { customer: mapCustomer(data) }
})
