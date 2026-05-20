import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import {
  REMINDER_TOKEN_RE,
  buildReminderKeyboard,
  buildReminderOfferText,
  formatAppointmentDateTime,
  isValidReminderMinutes,
  REMINDER_OPTIONS,
  validateAndNormalizeRussianPhone,
} from '@fastio/shared'
import { getServerSupabase } from '../../utils/supabase'
import { requireTelegramWebhookSecret } from '../../utils/auth'
import { telegramApiUrl, telegramFetch } from '../../utils/telegramFetch'
import { reportError } from '@fastio/shared/observability'

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
    const res = await telegramFetch(telegramApiUrl(token, 'sendMessage'), {
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

    // PREPROD-205: per-tg-id rate-limit для pending_telegram_auths.
    // Per-IP limit на /api/auth/telegram/init ловит атакующего с одного IP, но
    // юзер с динамическим IP (мобильный 4G, VPN-роутинг) обходит. Tg-id даёт
    // identity-level cap независимо от network.
    //
    // Silent ignore при hit — НЕ отвечаем юзеру error'ом, иначе бот станет
    // вектором DoS на legit-юзера (атакующий зная tg_id жертвы спамит /start
    // КОД от его имени → жертва получает 11 error-сообщений и не может войти).
    // reportError для метрики в Sentry — алерт по deviation.
    const { data: rlAllowed, error: rlError } = await supabase.rpc('consume_rate_limit', {
      _key: `tg-auth:tg-id:${telegramId}`,
      _max: 10,
      _window_seconds: 3600,
    })

    if (rlError) {
      reportError(rlError, { context: 'tg-auth-webhook:rate-limit', telegramId })

      return { ok: true }
    }
    if (!rlAllowed) {
      reportError(new Error('[tg-auth] per-tg-id rate-limited'), {
        context: 'tg-auth-webhook:rate-limit-hit',
        telegramId,
      })

      return { ok: true }
    }

    const { data: pending, error: pendingError } = await supabase
      .from('pending_telegram_auths')
      .select('nonce')
      .eq('nonce', nonce)
      .is('completed_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (pendingError) reportError(pendingError)

    if (!pending) {
      await sendMessage('❌ Ссылка для входа устарела или недействительна. Попробуйте войти заново.')

      return { ok: true }
    }

    // UPDATE только после того как убедились, что nonce валидный (not expired, not completed).
    // Иначе любой /start с угаданным/протёкшим nonce триггерил бы запись в БД.
    const { error: updateError } = await supabase
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
      .is('completed_at', null)
      .gt('expires_at', new Date().toISOString())

    if (updateError) {
      reportError(updateError)
      await sendMessage('❌ Не удалось сохранить вход. Попробуйте ещё раз.')

      return { ok: true }
    }

    const keyboard = {
      keyboard: [
        [{ text: '📱 Поделиться номером', request_contact: true }],
      ],
      one_time_keyboard: true,
      resize_keyboard: true,
      // Подсказка прямо в инпут-поле. На Telegram Web reply-клавиатура скрыта
      // по умолчанию (юзер сам её разворачивает иконкой), поэтому placeholder
      // в инпуте — единственный always-visible сигнал.
      input_field_placeholder: 'Нажмите кнопку с телефоном ↓',
    }

    await sendMessage(
      'Поделитесь номером телефона, чтобы войти.',
      { reply_markup: keyboard },
    )

    return { ok: true }
  }

  if (message.contact) {
    // Telegram отдаёт phone_number в международном формате (например '+79991234567'
    // или '79991234567' без плюса). Пропускаем через shared-утилку, чтобы хранить
    // канон '7XXXXXXXXXX' — тот же что и в orders/reservations. Не-РФ номера
    // (например '+12025550100') утилка вернёт null — сохраним как null и залогируем,
    // чтобы видеть в Sentry если такое начнёт массово приходить.
    const rawPhone = message.contact.phone_number ?? null
    const phone = rawPhone ? validateAndNormalizeRussianPhone(rawPhone) : null

    // На фронте стоит маска +7 — практически все contact'ы от Telegram приходят
    // с РФ-номером. Не-РФ сюда попадёт только если юзер сам поделился контактом
    // другой страны (Telegram отдаёт номер привязанный к его аккаунту).
    // В этом случае показываем явный отказ — не хотим юзера без идентификации.
    if (rawPhone && !phone) {
      reportError(new Error(`[tg-auth] non-RU phone from contact: ${rawPhone.slice(0, 4)}…`))
      await sendMessage('❌ Принимаем только российские номера. Войдите с РФ-номера или через сайт.')

      return { ok: true }
    }

    const telegramId = String(message.contact.user_id ?? message.from?.id ?? '')

    if (telegramId) {
      const pending = await findPendingByTelegramId(supabase, telegramId)

      if (pending) {
        const { error: updateError } = await supabase
          .from('pending_telegram_auths')
          .update({
            phone,
            completed_at: new Date().toISOString(),
          })
          .eq('nonce', pending.nonce)

        if (updateError) {
          reportError(updateError)
          await sendMessage('❌ Не удалось завершить вход. Попробуйте ещё раз.')

          return { ok: true }
        }
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
      await telegramFetch(telegramApiUrl(token, 'answerCallbackQuery'), {
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
      await telegramFetch(telegramApiUrl(token, 'sendMessage'), {
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
