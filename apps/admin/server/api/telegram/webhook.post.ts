import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getServerSupabase } from '../../utils/supabase'
import { requireTelegramWebhookSecret } from '../../utils/auth'
import { telegramFetch } from '../../utils/telegramFetch'
import { reportError } from '@fastio/shared/observability'

const LINK_CODE_REGEX = /^\d{6}$/
const RATE_LIMIT_MAX_ATTEMPTS = 5
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60

type ChatType = 'private' | 'group' | 'supergroup' | 'channel'

type TgChat = {
  id?: number
  type?: ChatType
  title?: string
  first_name?: string
  last_name?: string
  username?: string
  is_forum?: boolean
}

type TgUser = { first_name?: string; last_name?: string; username?: string }

type TgMessage = {
  chat?: TgChat
  from?: TgUser
  text?: string
  message_thread_id?: number
}

const chatLabel = (chat: TgChat, from?: TgUser): string => {
  if (chat.title) return chat.title

  const parts = [chat.first_name ?? from?.first_name, chat.last_name ?? from?.last_name]
    .filter(Boolean)

  if (parts.length) return parts.join(' ')

  const username = chat.username ?? from?.username

  return username ? `@${username}` : 'Telegram-чат'
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.telegramTenantBotToken

  if (!token) return { ok: true }

  requireTelegramWebhookSecret(event)

  const body = await readBody(event) as { message?: TgMessage }
  const message = body?.message

  const text: string = message?.text ?? ''
  const startMatch = text.match(/^\/start(?:@\S+)?\s+(\S+)/)

  if (!startMatch || !message?.chat?.id) return { ok: true }

  const code = startMatch[1]
  const chat = message.chat
  const chatId = chat.id!
  const chatType: ChatType = chat.type ?? 'private'
  const isForum = chat.is_forum === true
  const threadId: number | null = message.message_thread_id ?? (isForum ? 1 : null)

  // Format-фильтр ДО rate-limit: жжёт квоту только валидным 6-значным кодом.
  // Иначе /start abc, /start hello, любой мусор тоже расходовал бы попытки
  // и legit-юзер с опечатками упирался бы в лимит из-за чужого спама / своих
  // не-кодов в чат с ботом.
  if (!LINK_CODE_REGEX.test(code)) return { ok: true }

  const supabase = getServerSupabase()

  // Rate-limit ДО lookup: 6-значный код = 9×10⁵ комбинаций, без лимита подбирается
  // спамом /start <code>. consume_rate_limit (mig 264) — durable, horizontal-safe.
  // 5 попыток за 15 мин на chat: legit-юзер вводит код 1-2 раза → не достаёт;
  // атакующий упирается. Silent return при hit — не отвечаем боту, чтобы атакующий
  // не узнал что попал в лимит (UX legit не страдает: он сюда не попадает).
  //
  // Race window: между SELECT linkCode и DELETE нет lock — два webhook'а с
  // правильно угаданным кодом теоретически могут оба пройти SELECT и оба
  // INSERT'нуться (второй упадёт в 23505). Это accepted risk варианта B
  // (защищает rate-limit + TTL 3 мин); атомарный DELETE RETURNING — на потом.
  const { data: rlAllowed, error: rlError } = await supabase.rpc('consume_rate_limit', {
    _key: `telegram-link:${chatId}`,
    _max: RATE_LIMIT_MAX_ATTEMPTS,
    _window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  })

  if (rlError) {
    reportError(rlError, { context: 'telegram-webhook:rate-limit', chatId: String(chatId) })

    return { ok: true }
  }
  if (!rlAllowed) {
    // Sentry-сигнал на лимит: всплеск = либо атака на подбор, либо legit-юзер
    // забил неправильными кодами (M2 review). Алерт по deviation в Sentry.
    reportError(new Error('[telegram] link-code rate-limited'), {
      context: 'telegram-webhook:rate-limit-hit',
      chatId: String(chatId),
    })

    return { ok: true }
  }

  const sendMessage = (text: string, html = false) => {
    const payload: Record<string, unknown> = { chat_id: chatId, text }

    if (threadId) payload.message_thread_id = threadId
    if (html) payload.parse_mode = 'HTML'

    return telegramFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  const { data: linkCode } = await supabase
    .from('telegram_link_codes')
    .select('tenant_id, tenants!inner(name)')
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle() as { data: { tenant_id: string; tenants: { name: string } } | null }

  if (!linkCode) {
    // Sentry схлопывает по chatId fingerprint'у — алёрт по deviation настраивается в Sentry.
    // codePrefix (2 цифры) даёт корреляцию между попытками не раскрывая полный код в логах.
    reportError(new Error('[telegram] invalid link-code attempt'), {
      context: 'telegram-webhook:invalid-code',
      chatId: String(chatId),
      codePrefix: code.slice(0, 2),
    })
    await sendMessage('❌ Код устарел или недействителен. Сгенерируй новый в настройках.')

    return { ok: true }
  }

  const tenantName = linkCode.tenants?.name?.trim() || 'заведению'
  const label = chatLabel(chat, message.from)

  const { error: insertError } = await supabase
    .from('tenant_telegram_subscribers')
    .insert({
      tenant_id: linkCode.tenant_id,
      chat_id: String(chatId),
      chat_type: chatType,
      label,
      thread_id: threadId,
    })

  // 23505 = unique_violation → этот чат уже привязан к этому тенанту
  if (insertError && insertError.code !== '23505') {
    reportError(insertError, {
      context: 'telegram-webhook:subscriber-insert',
      chatId: String(chatId),
      tenantId: linkCode.tenant_id,
    })
    await sendMessage('⚠️ Не удалось сохранить подписку. Попробуй ещё раз.')

    return { ok: true }
  }

  // Код одноразовый — удаляем после успеха ИЛИ повторной привязки того же чата.
  await supabase.from('telegram_link_codes').delete().eq('code', code)

  if (insertError?.code === '23505') {
    await sendMessage(`ℹ️ Этот чат уже подключён к <b>${escapeHtml(tenantName)}</b>. Уведомления приходят сюда.`, true)

    return { ok: true }
  }

  const successMessage = chatType === 'private'
    ? `✅ Личный чат подключён к <b>${escapeHtml(tenantName)}</b>. Сюда будут приходить уведомления о новых заказах и записях клиентов.`
    : `✅ Группа подключена к <b>${escapeHtml(tenantName)}</b>. Сюда будут приходить уведомления о новых заказах и записях клиентов.`

  await sendMessage(successMessage, true)

  return { ok: true }
})

// Telegram HTML mode: парсит <b>, <i>, <a> и т.п. Значит '&', '<', '>' в plain
// тексте надо эскейпить — иначе при имени тенанта типа «<Test>» бот ответит
// "Bad Request: can't parse entities". См. https://core.telegram.org/bots/api#html-style
const escapeHtml = (s: string): string => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
