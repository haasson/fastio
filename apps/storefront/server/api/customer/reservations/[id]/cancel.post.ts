import { getTenantDb } from '../../../../utils/tenantDb'
import { getAuthenticatedContextWithCustomer } from '../../../../utils/customerAuth'
import { reportError } from '~/shared/utils/reportError'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const { customer } = await getAuthenticatedContextWithCustomer(event)

  if (customer.tenantId !== db.tenantId) throw createError({ statusCode: 403 })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id обязателен' })

  const { data: reservation, error: fetchError } = await db
    .from('reservations')
    .select('id, customer_id, status, allow_cancel_snapshot')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    reportError(fetchError, { context: 'customer-reservation-cancel.fetch', reservationId: id, tenantId: db.tenantId })
    throw createError({ statusCode: 500, message: 'Не удалось загрузить бронь' })
  }
  if (!reservation) throw createError({ statusCode: 404, message: 'Бронь не найдена' })
  if (reservation.customer_id !== customer.id) throw createError({ statusCode: 403 })

  // Snapshot предпочитаем live setting'у (как в appointments cancel): тенант не
  // может ретроактивно ужесточить policy. Legacy брони (snapshot=null) фолбэчат
  // на live reservation_settings.allow_client_cancellation.
  let allowCancel = reservation.allow_cancel_snapshot as boolean | null
  if (allowCancel === null) {
    const { data: settings } = await db
      .from('reservation_settings')
      .select('allow_client_cancellation')
      .maybeSingle()
    allowCancel = (settings?.allow_client_cancellation as boolean | undefined) ?? true
  }
  if (!allowCancel) throw createError({ statusCode: 403, message: 'Отмена недоступна' })

  // Cancellable только до посадки. seated/completed/cancelled/no_show — финальные.
  // Без deadline-check: модель без предоплаты, late-cancel == no-show, лучше иметь
  // сигнал отмены чем тихий no-show.
  if (reservation.status !== 'pending' && reservation.status !== 'confirmed') {
    throw createError({ statusCode: 400, message: 'Эту бронь уже нельзя отменить' })
  }

  // .select+.single — иначе на RLS-deny клиент получит {ok:true}, а запись жива.
  const { data: updated, error: updateError } = await db
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: 'cancelled_by_customer',
    })
    .eq('id', id)
    .select('id, status')
    .single()

  if (updateError || !updated) {
    reportError(updateError ?? new Error('[customer-reservation-cancel] update returned no row'), {
      context: 'customer-reservation-cancel.update',
      reservationId: id,
      tenantId: db.tenantId,
    })
    throw createError({ statusCode: 500, message: 'Не удалось отменить бронь' })
  }

  return { ok: true }
})
