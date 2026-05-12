import { randomBytes } from 'node:crypto'
import { useRuntimeConfig } from '#imports'
import {
  REMINDER_TOKEN_TTL_MS,
  REMINDER_UUID_RE,
  buildReminderKeyboard,
  buildReminderOfferText,
  formatAppointmentDateTime,
} from '@fastio/shared'
import { getTenantDb } from '../../utils/tenantDb'
import { getAuthenticatedContextWithCustomer } from '../../utils/customerAuth'
import { reportError } from '~/shared/utils/reportError'

type ApptRow = {
  starts_at: string
  service_name: string
  customer_name: string | null
  status: string
  customer_id: string | null
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const botToken = config.telegramAuthBotToken?.trim()
  if (!botToken) throw createError({ statusCode: 503, message: 'Telegram-напоминания не настроены' })

  const { customer } = await getAuthenticatedContextWithCustomer(event)
  if (!customer.telegramId) throw createError({ statusCode: 400, message: 'Аккаунт не привязан к Telegram' })

  const body = await readBody(event)
  const appointmentId: unknown = body?.appointmentId
  if (typeof appointmentId !== 'string' || !REMINDER_UUID_RE.test(appointmentId)) {
    throw createError({ statusCode: 400, message: 'Некорректный appointmentId' })
  }

  const db = getTenantDb(event)

  // tenant isolation (tenant_id auto-инжектится Proxy) + ownership check.
  const { data: appt } = await db.from('appointments')
    .select('starts_at, service_name, customer_name, status, customer_id')
    .eq('id', appointmentId)
    .eq('customer_id', customer.id)
    .maybeSingle() as { data: ApptRow | null }

  if (!appt) throw createError({ statusCode: 404, message: 'Запись не найдена' })
  if (appt.status === 'cancelled') throw createError({ statusCode: 400, message: 'Запись отменена' })

  const startsAt = new Date(appt.starts_at)
  if (startsAt.getTime() <= Date.now()) throw createError({ statusCode: 400, message: 'Запись уже прошла' })

  // Генерим одноразовый токен — он попадёт в callback_data inline-кнопок
  // и будет валидироваться webhook'ом при выборе минут.
  const reminderToken = randomBytes(16).toString('base64url')
  const expiresAtMs = Math.min(Date.now() + REMINDER_TOKEN_TTL_MS, startsAt.getTime())
  const expiresAt = new Date(expiresAtMs).toISOString()

  const { error: tokenError } = await db.crossTenant
    .from('appointment_reminder_tokens')
    .insert({ token: reminderToken, appointment_id: appointmentId, expires_at: expiresAt })

  if (tokenError) {
    reportError(tokenError)
    throw createError({ statusCode: 500, message: 'Не удалось создать токен' })
  }

  const { dateStr, timeStr } = formatAppointmentDateTime(startsAt)

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: customer.telegramId,
      text: buildReminderOfferText(appt.service_name, dateStr, timeStr),
      parse_mode: 'HTML',
      reply_markup: buildReminderKeyboard(reminderToken),
    }),
  })

  if (!tgRes.ok) {
    const err = await tgRes.json().catch(() => ({}))
    reportError(new Error(`[remind-offer] sendMessage failed: ${JSON.stringify(err)}`))
    throw createError({ statusCode: 502, message: 'Не удалось отправить сообщение в Telegram' })
  }

  return { ok: true }
})
