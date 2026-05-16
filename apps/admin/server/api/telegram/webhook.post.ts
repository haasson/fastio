import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getServerSupabase } from '../../utils/supabase'
import { requireTelegramWebhookSecret } from '../../utils/auth'
import { telegramFetch } from '../../utils/telegramFetch'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.telegramTenantBotToken

  if (!token) return { ok: true }

  requireTelegramWebhookSecret(event)

  const body = await readBody(event)
  const message = body?.message

  const text: string = message?.text ?? ''
  const startMatch = text.match(/^\/start(?:@\S+)?\s+(\S+)/)

  if (!startMatch) return { ok: true }

  const code = startMatch[1]
  const chatId: number = message.chat?.id
  const isForum: boolean = message.chat?.is_forum === true
  const threadId: number | null = message.message_thread_id ?? (isForum ? 1 : null)

  if (!code || !chatId) return { ok: true }

  const supabase = getServerSupabase()

  const sendMessage = (text: string) => {
    const payload: Record<string, unknown> = { chat_id: chatId, text }

    if (threadId) payload.message_thread_id = threadId

    return telegramFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  const { data: linkCode } = await supabase
    .from('telegram_link_codes')
    .select('tenant_id')
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!linkCode) {
    await sendMessage('❌ Код устарел или недействителен. Сгенерируй новый в настройках.')

    return { ok: true }
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('notifications')
    .eq('id', linkCode.tenant_id)
    .single()

  const chatTitle: string | null = message.chat?.title ?? null

  const notifications = {
    ...(tenant?.notifications ?? {}),
    telegramChatId: String(chatId),
    ...(threadId ? { telegramThreadId: threadId } : {}),
    ...(chatTitle ? { telegramChatTitle: chatTitle } : {}),
  }

  await Promise.all([
    supabase.from('tenants').update({ notifications }).eq('id', linkCode.tenant_id),
    supabase.from('telegram_link_codes').delete().eq('code', code),
  ])

  await sendMessage('✅ Группа подключена к ресторану! Теперь сюда будут приходить уведомления о новых заказах.')

  return { ok: true }
})
