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
    .select('id, customer_id, status, tenant_id, allow_cancel_snapshot')
    .eq('id', id)
    .single()

  if (!appt) throw createError({ statusCode: 404 })
  if (appt.customer_id !== customer.id) throw createError({ statusCode: 403 })
  if (appt.status === 'cancelled') throw createError({ statusCode: 400, message: 'Запись уже отменена' })
  if (appt.status === 'done') throw createError({ statusCode: 400, message: 'Запись уже завершена' })

  // Check allow_cancel snapshot — prefer snapshot taken at booking time, чтобы
  // ретроактивное изменение setting'а не лишило клиента права на отмену.
  // Deadline-check убран: модель без предоплаты, late-cancel == no-show по эффекту,
  // лучше иметь сигнал отмены чем тихий no-show (см. PREPROD-018 reservations,
  // та же логика). Колонка cancellation_deadline_hours в БД и UI оставлена
  // как dead code — см. TECHDEBT.
  const { data: settingsData } = await db
    .from('appointment_settings')
    .select('allow_client_cancellation')
    .maybeSingle()

  const allowCancel = (appt.allow_cancel_snapshot as boolean | null)
    ?? (settingsData?.allow_client_cancellation ?? true)
  if (!allowCancel) throw createError({ statusCode: 403, message: 'Отмена недоступна' })

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
