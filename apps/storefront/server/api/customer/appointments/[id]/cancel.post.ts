import { getTenantDb } from '../../../../utils/tenantDb'
import { getAuthenticatedContextWithCustomer } from '../../../../utils/customerAuth'
import { reportError } from '~/shared/utils/reportError'

// PREPROD-143: отмена записи клиентом идёт через RPC cancel_appointment_by_customer.
// RPC берёт row-lock на запись, проверяет ownership/allow_cancel_snapshot,
// меняет статус и пишет audit-event в appointment_events. Прямой UPDATE
// раньше тихо терял audit-trail — менеджер в админке не видел «отменено
// клиентом» в истории.

type CancelResult =
  | { ok: true; id: string }
  | { ok: false; reason: string }

const REASON_MESSAGES: Record<string, { statusCode: number, message: string }> = {
  invalid_args: { statusCode: 400, message: 'Некорректные данные' },
  not_found: { statusCode: 404, message: 'Запись не найдена' },
  forbidden: { statusCode: 403, message: 'Нет доступа к записи' },
  already_cancelled: { statusCode: 400, message: 'Запись уже отменена' },
  already_done: { statusCode: 400, message: 'Запись уже завершена' },
  cancel_disabled: { statusCode: 403, message: 'Отмена недоступна' },
}

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  // Поддерживаем оба способа авторизации: email/password (Bearer) и Telegram (cookie).
  // Telegram-only клиенты в записи имеют user_id=null, поэтому проверка владения
  // ведётся через customer.id (RPC сравнивает с appointments.customer_id).
  const { customer } = await getAuthenticatedContextWithCustomer(event)
  if (customer.tenantId !== db.tenantId) throw createError({ statusCode: 403 })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400 })

  const { data, error } = await db.raw.rpc('cancel_appointment_by_customer', {
    p_appointment_id: id,
    p_customer_id: customer.id,
  })

  if (error) {
    reportError(error, { context: 'customer.appointments.cancel:rpc' })
    throw createError({ statusCode: 500, message: 'Не удалось отменить запись' })
  }

  const result = data as CancelResult | null
  if (!result) {
    reportError(new Error('cancel_appointment_by_customer returned null'), {
      context: 'customer.appointments.cancel:rpc-empty',
      appointmentId: id,
    })
    throw createError({ statusCode: 500, message: 'Не удалось отменить запись' })
  }

  if (!result.ok) {
    const mapped = REASON_MESSAGES[result.reason] ?? { statusCode: 400, message: 'Не удалось отменить запись' }
    throw createError(mapped)
  }

  return { ok: true }
})
