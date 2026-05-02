import { getTenantDb } from '../../../../utils/tenantDb'
import { getAuthenticatedContextWithCustomer } from '../../../../utils/customerAuth'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  // Поддерживаем оба способа авторизации: email/password (Bearer) и Telegram (cookie).
  // Telegram-only клиенты в записи имеют user_id=null, поэтому проверка владения
  // ведётся через сопоставление customer.authUserId или customer.phone с записью.
  const { customer } = await getAuthenticatedContextWithCustomer(event)
  if (customer.tenantId !== db.tenantId) throw createError({ statusCode: 403 })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400 })

  const { data: appt } = await db
    .from('appointments')
    .select('id, customer_id, status, starts_at, tenant_id, allow_cancel_snapshot')
    .eq('id', id)
    .single()

  if (!appt) throw createError({ statusCode: 404 })
  if (appt.customer_id !== customer.id) throw createError({ statusCode: 403 })
  if (appt.status === 'cancelled') throw createError({ statusCode: 400, message: 'Запись уже отменена' })
  if (appt.status === 'done') throw createError({ statusCode: 400, message: 'Запись уже завершена' })

  // Check cancellation deadline. Prefer the snapshot taken at booking time —
  // tightening the live setting after the fact must not retroactively forbid
  // a cancellation the customer had a right to.
  const { data: settingsData } = await db
    .from('appointment_settings')
    .select('allow_client_cancellation, cancellation_deadline_hours')
    .maybeSingle()

  const allowCancel = (appt.allow_cancel_snapshot as boolean | null)
    ?? (settingsData?.allow_client_cancellation ?? true)
  if (!allowCancel) throw createError({ statusCode: 403, message: 'Отмена недоступна' })

  const deadlineHours = (settingsData?.cancellation_deadline_hours as number) ?? 2
  const startsAt = new Date(appt.starts_at as string)
  const nowUtc = new Date()
  const hoursUntilStart = (startsAt.getTime() - nowUtc.getTime()) / (1000 * 60 * 60)

  if (hoursUntilStart < deadlineHours) {
    throw createError({
      statusCode: 400,
      message: `Отмена возможна не позднее чем за ${deadlineHours} ч. до записи`,
    })
  }

  // Возвращаем строку и проверяем error: иначе при RLS-deny клиент получает {ok:true},
  // а запись остаётся живой.
  const { data: updated, error: updateError } = await db
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_by: 'customer',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, status')
    .single()

  if (updateError || !updated) {
    throw createError({ statusCode: 500, message: 'Не удалось отменить запись' })
  }

  return { ok: true }
})
