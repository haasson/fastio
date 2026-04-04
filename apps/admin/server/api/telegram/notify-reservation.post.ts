import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getServerSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { reservationId, tenantId } = await readBody(event)

  if (!reservationId || !tenantId) return { ok: true }

  const config = useRuntimeConfig()
  const token = config.telegramBotToken

  if (!token) return { ok: true }

  const supabase = getServerSupabase()

  const [{ data: tenant }, { data: reservation }] = await Promise.all([
    supabase.from('tenants').select('notifications').eq('id', tenantId).single(),
    supabase
      .from('reservations')
      .select('guest_name, guest_phone, guest_count, reserved_date, reserved_time, comment, table_name')
      .eq('id', reservationId)
      .eq('tenant_id', tenantId)
      .single(),
  ])

  const chatId = tenant?.notifications?.telegramChatId
  const threadId = tenant?.notifications?.telegramThreadId ?? null

  if (!chatId || !reservation) return { ok: true }

  const date = new Date(`${reservation.reserved_date}T${reservation.reserved_time}`)
  const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const timeStr = reservation.reserved_time.slice(0, 5)

  let text = `📅 <b>Новое бронирование</b>\n\n`

  text += `👤 ${reservation.guest_name}\n`
  text += `📞 ${reservation.guest_phone}\n`
  text += `👥 ${reservation.guest_count} ${guestWord(reservation.guest_count)}\n`
  text += `🗓 ${dateStr} в ${timeStr}\n`
  if (reservation.table_name) text += `🪑 ${reservation.table_name}\n`
  if (reservation.comment) text += `💬 ${reservation.comment}\n`

  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' }

  if (threadId) payload.message_thread_id = threadId

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

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
