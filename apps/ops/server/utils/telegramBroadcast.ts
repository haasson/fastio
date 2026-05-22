import type { SupabaseClient } from '@supabase/supabase-js'
import { telegramApiUrl, telegramFetch } from './telegramFetch'

type Subscriber = {
  id: string
  chat_id: string
  chat_type: 'private' | 'group' | 'supergroup' | 'channel'
  thread_id: number | null
}

type TgResponse = { ok: boolean; description?: string; error_code?: number }

// Удаляем подписчика только при необратимых отказах: бота заблокировали,
// кикнули, чат не существует. Сетевые/временные ошибки — оставляем.
const isDeadSubscription = (res: TgResponse): boolean => {
  if (!res.description) return false

  const d = res.description.toLowerCase()

  return (
    res.error_code === 403
    || d.includes('chat not found')
    || d.includes('bot was kicked')
    || d.includes('bot was blocked')
    || d.includes('user is deactivated')
    || d.includes('bot is not a member')
    || d.includes('group chat was upgraded')
  )
}

export type BroadcastResult = {
  sent: number
  failed: number
  removed: number
}

// Шлёт payload во ВСЕ telegram-подписки тенанта. payloadBuilder получает
// конкретного подписчика → может подмешать chat_id/message_thread_id. Если
// телеграм отвечает "необратимым" отказом — подписчик автоудаляется.
export async function broadcastToTenantTelegram(
  supabase: SupabaseClient,
  token: string,
  tenantId: string,
  payloadBuilder: (sub: Subscriber) => Record<string, unknown>,
  logTag: string,
): Promise<BroadcastResult> {
  const { data: subs, error } = await supabase
    .from('tenant_telegram_subscribers')
    .select('id, chat_id, chat_type, thread_id')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error(`[${logTag}] failed to load subscribers:`, error)

    return { sent: 0, failed: 0, removed: 0 }
  }

  if (!subs?.length) return { sent: 0, failed: 0, removed: 0 }

  const result: BroadcastResult = { sent: 0, failed: 0, removed: 0 }
  const deadIds: string[] = []

  await Promise.allSettled(subs.map(async (sub) => {
    const payload = {
      chat_id: sub.chat_id,
      ...(sub.thread_id ? { message_thread_id: sub.thread_id } : {}),
      ...payloadBuilder(sub as Subscriber),
    }

    try {
      const tgRes = await telegramFetch(telegramApiUrl(token, 'sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await tgRes.json() as TgResponse

      if (data.ok) {
        result.sent++

        return
      }

      result.failed++
      console.error(`[${logTag}] sendMessage failed for chat ${sub.chat_id}:`, JSON.stringify(data))

      if (isDeadSubscription(data)) deadIds.push(sub.id)
    } catch (e) {
      result.failed++
      console.error(`[${logTag}] sendMessage exception for chat ${sub.chat_id}:`, e)
    }
  }))

  if (deadIds.length) {
    const { error: delError } = await supabase
      .from('tenant_telegram_subscribers')
      .delete()
      .in('id', deadIds)

    if (delError) {
      console.error(`[${logTag}] failed to prune dead subscribers:`, delError)
    } else {
      result.removed = deadIds.length
    }
  }

  return result
}
