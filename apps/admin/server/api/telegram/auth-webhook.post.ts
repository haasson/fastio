import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import {
  REMINDER_TOKEN_RE,
  buildReminderKeyboard,
  buildReminderOfferText,
  formatAppointmentDateTime,
  isValidReminderMinutes,
  REMINDER_OPTIONS,
} from '@fastio/shared'
import { getServerSupabase } from '../../utils/supabase'
import { requireTelegramWebhookSecret } from '../../utils/auth'
import { telegramFetch } from '../../utils/telegramFetch'
import { reportError } from '~/shared/utils/reportError'

const SKIP_PHONE_TEXT = 'Войти без номера'

type TgUser = { id?: number; first_name?: string; last_name?: string; username?: string }
type TgContact = { phone_number?: string; user_id?: number }
type TgMessage = { chat?: { id?: number }; from?: TgUser; text?: string; contact?: TgContact }
type TgCallbackQuery = {
  id: string
  from: TgUser
  message?: { chat?: { id?: number } }
  data?: string
}
type TgUpdate = { message?: TgMessage; callback_query?: TgCallbackQuery }

type ApptRow = { starts_at: string; service_name: string; status: string }
type TokenRow = { appointment_id: string; expires_at: string }

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.telegramClientBotToken?.trim()

  if (!token) return { ok: true }

  requireTelegramWebhookSecret(event)

  const body: TgUpdate = await readBody(event)

  if (body.callback_query) {
    return handleCallbackQuery(body.callback_query, token)
  }

  const message = body?.message

  if (!message) return { ok: true }

  const chatId = message.chat?.id

  if (!chatId) return { ok: true }

  const sendMessage = async (text: string, extra: Record<string, unknown> = {}) => {
    const res = await telegramFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, ...extra }),
    })
    const data = await res.json() as { ok: boolean; description?: string }

    if (!data.ok) console.error('[tg-auth] sendMessage failed:', data.description)

    return data
  }

  const supabase = getServerSupabase()
  const text: string = message.text ?? ''

  const startMatch = text.match(/^\/start(?:@\S+)?\s+(\S+)/)

  if (startMatch) {
    const payload = startMatch[1]

    if (payload.startsWith('remind_')) {
      const reminderToken = payload.slice('remind_'.length)

      return handleRemindDeepLink(reminderToken, chatId, supabase, sendMessage)
    }

    // Стандартный auth flow
    const nonce = payload
    const from = message.from

    if (!from?.id) return { ok: true }

    const telegramId = String(from.id)

    const { data: pending } = await supabase
      .from('pending_telegram_auths')
      .select('nonce')
      .eq('nonce', nonce)
      .is('completed_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    await supabase
      .from('pending_telegram_auths')
      .update({
        telegram_id: telegramId,
        telegram_data: {
          first_name: from.first_name ?? null,
          last_name: from.last_name ?? null,
          username: from.username ?? null,
        },
      })
      .eq('nonce', nonce)

    if (!pending) {
      await sendMessage('❌ Ссылка для входа устарела или недействительна. Попробуйте войти заново.')

      return { ok: true }
    }

    const keyboard = {
      keyboard: [
        [{ text: '📱 Поделиться номером', request_contact: true }],
        [{ text: SKIP_PHONE_TEXT }],
      ],
      one_time_keyboard: true,
      resize_keyboard: true,
    }

    await sendMessage(
      'Поделитесь номером телефона, чтобы продолжить — или войдите без него.',
      { reply_markup: keyboard },
    )

    return { ok: true }
  }

  if (message.contact) {
    const phone = message.contact.phone_number?.replace(/\D/g, '') ?? null
    const telegramId = String(message.contact.user_id ?? message.from?.id ?? '')

    if (telegramId) {
      const pending = await findPendingByTelegramId(supabase, telegramId)

      if (pending) {
        await supabase
          .from('pending_telegram_auths')
          .update({
            phone,
            completed_at: new Date().toISOString(),
          })
          .eq('nonce', pending.nonce)
      }
    }

    await sendMessage('✅ Готово! Возвращайтесь на сайт — вход выполнится автоматически.')

    return { ok: true }
  }

  if (text === SKIP_PHONE_TEXT) {
    const telegramId = String(message.from?.id ?? '')

    if (telegramId) {
      const pending = await findPendingByTelegramId(supabase, telegramId)

      if (pending) {
        await supabase
          .from('pending_telegram_auths')
          .update({
            phone: null,
            completed_at: new Date().toISOString(),
          })
          .eq('nonce', pending.nonce)
      }
    }

    await sendMessage('✅ Готово! Возвращайтесь на сайт — вход выполнится автоматически.')

    return { ok: true }
  }

  return { ok: true }
})

async function handleRemindDeepLink(
  reminderToken: string,
  chatId: number,
  supabase: ReturnType<typeof getServerSupabase>,
  sendMessage: (text: string, extra?: Record<string, unknown>) => Promise<{ ok: boolean }>,
) {
  if (!REMINDER_TOKEN_RE.test(reminderToken)) {
    await sendMessage('❌ Некорректная ссылка.')

    return { ok: true }
  }

  // Резолв токена → appointment. Токен живёт ограниченное время и удаляется
  // после первого успешного выбора (см. handleCallbackQuery).
  const { data: tokRow } = await supabase
    .from('appointment_reminder_tokens')
    .select('appointment_id, expires_at')
    .eq('token', reminderToken)
    .maybeSingle() as { data: TokenRow | null }

  if (!tokRow || new Date(tokRow.expires_at).getTime() < Date.now()) {
    await sendMessage('❌ Ссылка устарела или уже использована.')

    return { ok: true }
  }

  const { data: appt } = await supabase
    .from('appointments')
    .select('starts_at, service_name, status')
    .eq('id', tokRow.appointment_id)
    .maybeSingle() as { data: ApptRow | null }

  if (!appt || appt.status === 'cancelled') {
    await sendMessage('❌ Запись не найдена или была отменена.')

    return { ok: true }
  }

  const startsAt = new Date(appt.starts_at)

  if (startsAt.getTime() <= Date.now()) {
    await sendMessage('ℹ️ Эта запись уже прошла.')

    return { ok: true }
  }

  const { dateStr, timeStr } = formatAppointmentDateTime(startsAt)

  const { data: existing } = await supabase
    .from('appointment_reminders')
    .select('remind_before_minutes')
    .eq('appointment_id', tokRow.appointment_id)
    .eq('telegram_chat_id', String(chatId))
    .maybeSingle()

  if (existing) {
    const opt = REMINDER_OPTIONS.find((o) => o.minutes === existing.remind_before_minutes)

    await sendMessage(
      `✅ Напоминание уже настроено!\n\n📋 ${appt.service_name}\n📅 ${dateStr} в ${timeStr}\n\n🔔 ${opt?.label ?? `за ${existing.remind_before_minutes} мин`}`,
    )

    return { ok: true }
  }

  await sendMessage(
    buildReminderOfferText(appt.service_name, dateStr, timeStr),
    { parse_mode: 'HTML', reply_markup: buildReminderKeyboard(reminderToken) },
  )

  return { ok: true }
}

async function handleCallbackQuery(query: TgCallbackQuery, token: string) {
  const chatId = query.message?.chat?.id

  if (!chatId) return { ok: true }

  const supabase = getServerSupabase()

  const answerCallback = async (text?: string) => {
    try {
      await telegramFetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: query.id, text }),
      })
    } catch (e) {
      reportError(e)
    }
  }

  const sendReply = async (text: string) => {
    try {
      await telegramFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      })
    } catch (e) {
      reportError(e)
    }
  }

  // remind_<token>_<minutes>
  const remindMatch = query.data?.match(/^remind_([A-Za-z0-9_-]{22})_(\d+)$/)

  if (!remindMatch) {
    await answerCallback()

    return { ok: true }
  }

  const reminderToken = remindMatch[1]
  const minutes = parseInt(remindMatch[2], 10)

  if (!isValidReminderMinutes(minutes)) {
    await answerCallback('Некорректный вариант.')

    return { ok: true }
  }

  const { data: tokRow } = await supabase
    .from('appointment_reminder_tokens')
    .select('appointment_id, expires_at')
    .eq('token', reminderToken)
    .maybeSingle() as { data: TokenRow | null }

  if (!tokRow || new Date(tokRow.expires_at).getTime() < Date.now()) {
    await answerCallback('Ссылка устарела или уже использована.')

    return { ok: true }
  }

  const { data: appt } = await supabase
    .from('appointments')
    .select('starts_at, service_name, status')
    .eq('id', tokRow.appointment_id)
    .maybeSingle() as { data: ApptRow | null }

  if (!appt || appt.status === 'cancelled') {
    await answerCallback('Запись не найдена или отменена.')

    return { ok: true }
  }

  const { error: upsertError } = await supabase
    .from('appointment_reminders')
    .upsert(
      { appointment_id: tokRow.appointment_id, telegram_chat_id: String(chatId), remind_before_minutes: minutes },
      { onConflict: 'appointment_id,telegram_chat_id' },
    )

  if (upsertError) {
    reportError(upsertError)
    await answerCallback('Не удалось сохранить напоминание. Попробуйте ещё раз.')

    return { ok: true }
  }

  // Single-use: токен сжигаем после успешного выбора. Если клиент захочет
  // изменить минуты — пусть запросит свежий токен через storefront.
  const { error: deleteError } = await supabase
    .from('appointment_reminder_tokens')
    .delete()
    .eq('token', reminderToken)

  if (deleteError) reportError(deleteError)

  const opt = REMINDER_OPTIONS.find((o) => o.minutes === minutes)
  const label = opt?.label ?? `за ${minutes} мин`
  const { dateStr, timeStr } = formatAppointmentDateTime(new Date(appt.starts_at))

  await answerCallback('✅ Напоминание сохранено!')
  await sendReply(`✅ Готово! Напомним ${label.toLowerCase()} до начала.\n\n📋 ${appt.service_name}\n📅 ${dateStr} в ${timeStr}`)

  return { ok: true }
}

async function findPendingByTelegramId(
  supabase: ReturnType<typeof getServerSupabase>,
  telegramId: string,
) {
  const { data } = await supabase
    .from('pending_telegram_auths')
    .select('nonce')
    .eq('telegram_id', telegramId)
    .is('completed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}
