import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getServerSupabase } from '../../utils/supabase'
import { requireTelegramWebhookSecret } from '../../utils/auth'
import { telegramFetch } from '../../utils/telegramFetch'

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

  const supabase = getServerSupabase()

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
    console.error('[telegram webhook] subscriber insert failed:', insertError)
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
