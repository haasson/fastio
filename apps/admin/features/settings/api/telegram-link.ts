import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantTelegramSubscriber } from '@fastio/shared'
import { query } from '~/shared/utils/query'

type SubscriberRow = {
  id: string
  tenant_id: string
  chat_id: string
  chat_type: TenantTelegramSubscriber['chatType']
  label: string | null
  thread_id: number | null
  added_at: string
}

const mapRow = (r: SubscriberRow): TenantTelegramSubscriber => ({
  id: r.id,
  tenantId: r.tenant_id,
  chatId: r.chat_id,
  chatType: r.chat_type,
  label: r.label,
  threadId: r.thread_id,
  addedAt: r.added_at,
})

export const telegramLinkApi = {
  // Создаёт/обновляет код привязки tg-чата. Один активный код на тенант (UNIQUE tenant_id).
  // expires_at передаём явно: при upsert-update DEFAULT в DB НЕ срабатывает повторно,
  // и без этого старая просрочка переезжает на новый код → юзер видит «код устарел».
  async upsertCode(sb: SupabaseClient, tenantId: string, code: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await query(
      sb.from('telegram_link_codes').upsert(
        { code, tenant_id: tenantId, expires_at: expiresAt },
        { onConflict: 'tenant_id' },
      ),
    )
  },

  async listSubscribers(sb: SupabaseClient, tenantId: string): Promise<TenantTelegramSubscriber[]> {
    const rows = await query(
      sb.from('tenant_telegram_subscribers')
        .select('id, tenant_id, chat_id, chat_type, label, thread_id, added_at')
        .eq('tenant_id', tenantId)
        .order('added_at', { ascending: true }),
    ) as SubscriberRow[] | null

    return (rows ?? []).map(mapRow)
  },

  async removeSubscriber(sb: SupabaseClient, subscriberId: string): Promise<void> {
    await query(
      sb.from('tenant_telegram_subscribers').delete().eq('id', subscriberId),
    )
  },
}
