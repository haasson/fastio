import { validateAndNormalizeRussianPhone } from '@fastio/shared'
import { mapCustomer } from '../../utils/supabase'
import { getAuthenticatedContext } from '../../utils/customerAuth'
import { reportError } from '@fastio/shared/observability'

const NAME_MAX_LENGTH = 100

export default defineEventHandler(async (event) => {
  const { customerId, supabase } = await getAuthenticatedContext(event)
  const body = await readBody(event)

  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') throw createError({ statusCode: 400, message: 'Некорректное имя' })
    const trimmed = body.name.trim()
    if (trimmed.length === 0 || trimmed.length > NAME_MAX_LENGTH) {
      throw createError({ statusCode: 400, message: `Имя должно быть от 1 до ${NAME_MAX_LENGTH} символов` })
    }
    updates.name = trimmed
  }
  if (body.phone !== undefined) {
    // Контракт: для очистки телефона клиент шлёт null ИЛИ пустую строку.
    // Пустую строку поддерживаем потому что UI (account/profile.vue) при стирании поля
    // даёт ровно её — менять контракт здесь = менять UI. См. updateProfile в features/auth/stores/auth.ts.
    if (body.phone === null || body.phone === '') {
      updates.phone = null
    } else if (typeof body.phone !== 'string') {
      throw createError({ statusCode: 400, message: 'Некорректный телефон' })
    } else {
      const normalized = validateAndNormalizeRussianPhone(body.phone.trim())
      if (!normalized) throw createError({ statusCode: 400, message: 'Некорректный номер телефона' })
      updates.phone = normalized
    }
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

  if (error || !data) {
    if (error) reportError(error)
    throw createError({ statusCode: 500, message: 'Не удалось обновить профиль' })
  }

  return { customer: mapCustomer(data) }
})
