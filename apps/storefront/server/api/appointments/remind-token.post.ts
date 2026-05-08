import { randomBytes } from 'node:crypto'
import { REMINDER_TOKEN_TTL_MS, REMINDER_UUID_RE } from '@fastio/shared'
import { getTenantDb } from '../../utils/tenantDb'
import { getAuthenticatedContextWithCustomer } from '../../utils/customerAuth'
import { reportError } from '~/utils/reportError'

type ApptRow = {
  starts_at: string
  status: string
  customer_id: string | null
}

/**
 * Выдаёт одноразовый токен для deep-link `t.me/<bot>?start=remind_<token>`.
 * Только владелец записи (customer_id == authenticated.customer.id). Токен живёт
 * до min(starts_at, now + 7 дней) и удаляется после первого выбора напоминания.
 */
export default defineEventHandler(async (event) => {
  const { customer } = await getAuthenticatedContextWithCustomer(event)

  const body = await readBody(event)
  const appointmentId: unknown = body?.appointmentId
  if (typeof appointmentId !== 'string' || !REMINDER_UUID_RE.test(appointmentId)) {
    throw createError({ statusCode: 400, message: 'Некорректный appointmentId' })
  }

  const db = getTenantDb(event)

  const { data: appt } = await db.from('appointments')
    .select('starts_at, status, customer_id')
    .eq('id', appointmentId)
    .eq('customer_id', customer.id)
    .maybeSingle() as { data: ApptRow | null }

  if (!appt) throw createError({ statusCode: 404, message: 'Запись не найдена' })
  if (appt.status === 'cancelled') throw createError({ statusCode: 400, message: 'Запись отменена' })

  const startsAtMs = new Date(appt.starts_at).getTime()
  if (startsAtMs <= Date.now()) throw createError({ statusCode: 400, message: 'Запись уже прошла' })

  const token = randomBytes(16).toString('base64url')
  const expiresAtMs = Math.min(Date.now() + REMINDER_TOKEN_TTL_MS, startsAtMs)
  const expiresAt = new Date(expiresAtMs).toISOString()

  const { error } = await db.crossTenant
    .from('appointment_reminder_tokens')
    .insert({ token, appointment_id: appointmentId, expires_at: expiresAt })

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Не удалось создать токен' })
  }

  return { token }
})
