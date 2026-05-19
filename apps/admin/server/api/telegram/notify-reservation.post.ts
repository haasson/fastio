import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { formatPhone, normalizePhone } from '@fastio/shared'
import { getServerSupabase } from '../../utils/supabase'
import { requireInternalSecret } from '../../utils/auth'
import { broadcastToTenantTelegram } from '../../utils/telegramBroadcast'

export default defineEventHandler(async (event) => {
  requireInternalSecret(event)

  const { reservationId, tenantId } = await readBody(event)

  if (!reservationId || !tenantId) return { ok: true }

  const config = useRuntimeConfig()
  const token = config.telegramTenantBotToken
  const adminUrl = config.adminUrl?.trim()

  if (!token) return { ok: true }

  const supabase = getServerSupabase()

  const [{ data: tenant }, { data: reservation }] = await Promise.all([
    supabase.from('tenants').select('timezone').eq('id', tenantId).single(),
    supabase
      .from('reservations')
      .select('guest_name, guest_phone, guest_count, reserved_date, reserved_time, comment, table_name')
      .eq('id', reservationId)
      .eq('tenant_id', tenantId)
      .single(),
  ])

  if (!reservation) return { ok: true }

  const tz = tenant?.timezone
  const dateStr = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: tz })
    .format(new Date(`${reservation.reserved_date}T12:00:00Z`))
  const timeStr = reservation.reserved_time.slice(0, 5)

  let text = `📅 <b>Новое бронирование</b>\n\n`

  text += `👤 ${reservation.guest_name}\n`
  text += `📞 ${formatPhone(reservation.guest_phone)}\n`
  text += `👥 ${reservation.guest_count} ${guestWord(reservation.guest_count)}\n`
  text += `🗓 ${dateStr} в ${timeStr}\n`
  if (reservation.table_name) text += `🪑 ${reservation.table_name}\n`
  if (reservation.comment) text += `💬 ${reservation.comment}\n`

  // guest_phone теперь хранится в каноне '7XXXXXXXXXX' (см. reservations/index.post.ts),
  // но прогоняем через shared normalizePhone на случай старых записей с маской/+.
  const phoneDigits = normalizePhone(reservation.guest_phone)
  const replyMarkup = adminUrl
    ? {
        inline_keyboard: [[{ text: '📞 Позвонить', url: `${adminUrl}/api/tel/${phoneDigits}` }]],
      }
    : null

  await broadcastToTenantTelegram(supabase, token, tenantId, () => ({
    text,
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  }), 'telegram notify-reservation')

  return { ok: true }
})

function guestWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100

  if (mod100 >= 11 && mod100 <= 19) return 'гостей'
  if (mod10 === 1) return 'гость'
  if (mod10 >= 2 && mod10 <= 4) return 'гостя'

  return 'гостей'
}
