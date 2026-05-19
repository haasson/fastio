import { reportError } from '~/shared/utils/reportError'
import { getTenantDb } from '../../../utils/tenantDb'

/**
 * Список настроенных типов вызова официанта (счёт / дозаказ / помощь и т.д.) для тенанта.
 * Возвращает [] если тенант не настроил ни одного — UI тогда показывает кнопку
 * с дефолтным «Вызвать официанта».
 *
 * IDOR guard как и в check.get.ts: гость должен иметь cookie от QR-сканирования.
 */
export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const tableId = getRouterParam(event, 'id')
  if (!tableId) throw createError({ statusCode: 400 })

  if (getCookie(event, 'fastio_table') !== tableId) {
    throw createError({ statusCode: 403, message: 'Сначала отсканируйте QR-код стола' })
  }

  const { data, error } = await db
    .from('table_call_types')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Не удалось загрузить типы вызова' })
  }

  return {
    types: (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
    })),
  }
})
