import { createError, defineEventHandler, getHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { MAX_REMINDER_MINUTES, REMINDER_OPTIONS, formatAppointmentDateTime } from '@fastio/shared'
import { getServerSupabase } from '../../utils/supabase'
import { telegramApiUrl, telegramFetch } from '../../utils/telegramFetch'
import { reportError } from '@fastio/shared/observability'

type ReminderRow = {
  id: string
  telegram_chat_id: string
  remind_before_minutes: number
  appointment: { starts_at: string; service_name: string; customer_name: string | null }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Совпадает по паттерну с requireInternalSecret/requireTelegramWebhookSecret из utils/auth.ts:
  // missing env → 500 (а не молча skip — иначе endpoint открыт публично и любой может
  // триггерить рассылку напоминаний → DOS на Telegram-API + ban наших ботов).
  // wrong secret → 403 (а не {ok:true} — это маскировало бы попытки атаки в логах).
  const secret = config.reminderCronSecret?.trim()

  if (!secret) {
    // reportError + console.error: console.error пойдёт в Coolify logs (видно
    // здесь и сейчас), reportError создаст Sentry-инцидент с fingerprint —
    // Sentry схлопнет 1440 алертов/день в одну issue вместо потопа.
    const err = new Error('[reminder-cron] NUXT_REMINDER_CRON_SECRET not configured')

    console.error(err.message)
    reportError(err)
    throw createError({ statusCode: 500, statusMessage: 'Cron secret not configured' })
  }

  if (getHeader(event, 'x-reminder-cron-secret') !== secret) {
    throw createError({ statusCode: 403 })
  }

  const token = config.telegramClientBotToken?.trim()

  if (!token) return { ok: true }

  const supabase = getServerSupabase()
  const now = new Date()

  // Окно: starts_at от 1ч назад до MAX_REMINDER_MINUTES вперёд + 1 мин буфер.
  // Точная фильтрация (remindAt <= now) делается в JS.
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const horizon = new Date(now.getTime() + (MAX_REMINDER_MINUTES + 1) * 60 * 1000).toISOString()

  const { data: rows, error: fetchError } = await supabase
    .from('appointment_reminders')
    .select(`
      id,
      telegram_chat_id,
      remind_before_minutes,
      appointment:appointments!inner (
        starts_at,
        service_name,
        customer_name
      )
    `)
    .is('sent_at', null)
    .gte('appointments.starts_at', cutoff)
    .lte('appointments.starts_at', horizon)

  if (fetchError) {
    reportError(fetchError)

    return { ok: true }
  }

  const due = ((rows ?? []) as unknown as ReminderRow[]).filter((row) => {
    const remindAtMs = new Date(row.appointment.starts_at).getTime() - row.remind_before_minutes * 60 * 1000

    return remindAtMs <= now.getTime()
  })

  if (due.length === 0) return { ok: true }

  // Telegram Bot API rate-limit: ~30 msg/sec глобально на бота. Чтобы не
  // словить 429 (а в худшем случае — temp-ban бота, который ломает весь
  // прод-функционал уведомлений), чанкуем по 20 с паузой 1 сек между
  // батчами. Обычно due.length = единицы, всё уйдёт первым батчем мгновенно;
  // защита нужна на случай восстановления после простоя cron, когда
  // накопилось 500+ напоминаний.
  for (let i = 0; i < due.length; i += BATCH_SIZE) {
    const batch = due.slice(i, i + BATCH_SIZE)

    await Promise.all(batch.map((row) => processReminder(row, token, supabase, now)))

    if (i + BATCH_SIZE < due.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  return { ok: true }
})

const BATCH_SIZE = 20
const BATCH_DELAY_MS = 1000

async function processReminder(
  row: ReminderRow,
  token: string,
  supabase: ReturnType<typeof getServerSupabase>,
  now: Date,
) {
  // Атомарно «застолбить»: UPDATE ... WHERE sent_at IS NULL.
  // Если два инстанса cron стартовали одновременно — только один получит строку обратно.
  const { data: claimed } = await supabase
    .from('appointment_reminders')
    .update({ sent_at: now.toISOString() })
    .eq('id', row.id)
    .is('sent_at', null)
    .select('id')

  if (!claimed?.length) return // уже застолблено другим воркером

  // Защита от мусора в БД: Telegram chat_id всегда integer (positive для приватных
  // чатов, negative для групп). Если в telegram_chat_id попала пустая строка или
  // не-число (баг при сохранении, миграция данных и т.п.), Telegram вернёт 400 и
  // мы запишем permanent-error на КАЖДУЮ минуту cron'а (sent_at уже now, повторов
  // нет, но reportError будет шуметь). Лучше отсечь до fetch.
  if (!/^-?\d+$/.test(row.telegram_chat_id)) {
    reportError(new Error(`[reminder-cron] invalid telegram_chat_id format for reminder ${row.id}: ${JSON.stringify(row.telegram_chat_id)}`))

    return
  }

  const { appointment: appt } = row
  const { dateStr, timeStr } = formatAppointmentDateTime(new Date(appt.starts_at))
  const opt = REMINDER_OPTIONS.find((o) => o.minutes === row.remind_before_minutes)
  const greeting = appt.customer_name ? `${appt.customer_name}, напоминаем` : 'Напоминаем'
  const text = `🔔 ${greeting}!\n\nУ вас запись:\n📋 ${appt.service_name}\n📅 ${dateStr} в ${timeStr}\n\n🕐 ${opt?.label ?? `за ${row.remind_before_minutes} мин`}`

  let tgRes: Awaited<ReturnType<typeof telegramFetch>>

  try {
    tgRes = await telegramFetch(telegramApiUrl(token, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: row.telegram_chat_id, text }),
    })
  } catch (e) {
    // Network-fail — transient. Откатываем claim, чтобы попробовать снова на следующей минуте.
    reportError(new Error(`[reminder-cron] network error for reminder ${row.id}: ${(e as Error).message}`))
    await releaseClaim(supabase, row.id)

    return
  }

  if (tgRes.ok) return

  const err = await tgRes.json().catch(() => ({}))

  // Permanent (4xx): юзер заблокировал бота / chat_id невалиден / запрет от Telegram.
  // Долбиться повторно бессмысленно — sent_at оставляем, чтобы не зацикливать.
  if (tgRes.status >= 400 && tgRes.status < 500) {
    reportError(new Error(`[reminder-cron] permanent Telegram error ${tgRes.status} for reminder ${row.id}: ${JSON.stringify(err)}`))

    return
  }

  // Transient (5xx): откатываем claim — следующая минута попробует снова.
  reportError(new Error(`[reminder-cron] transient Telegram error ${tgRes.status} for reminder ${row.id}: ${JSON.stringify(err)}`))
  await releaseClaim(supabase, row.id)
}

async function releaseClaim(supabase: ReturnType<typeof getServerSupabase>, id: string) {
  const { error } = await supabase
    .from('appointment_reminders')
    .update({ sent_at: null })
    .eq('id', id)

  if (error) reportError(error)
}
