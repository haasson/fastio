import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tenant } from '@fastio/shared'
import { query } from '~/shared/utils/query'

type TenantNotifications = Tenant['notifications']

export const telegramLinkApi = {
  // Создаёт/обновляет код привязки tg-группы. Один активный код на тенант (UNIQUE tenant_id).
  async upsertCode(sb: SupabaseClient, tenantId: string, code: string): Promise<void> {
    await query(
      sb.from('telegram_link_codes').upsert(
        { code, tenant_id: tenantId },
        { onConflict: 'tenant_id' },
      ),
    )
  },

  // Лёгкий запрос для поллинга факта привязки tg-чата. Не зовём tenantsApi.getById,
  // чтобы не пулить весь tenant-row каждые N секунд.
  async getTelegramChatId(sb: SupabaseClient, tenantId: string): Promise<string | null> {
    const row = await query(
      sb.from('tenants').select('notifications').eq('id', tenantId).single(),
    )

    return (row as { notifications: TenantNotifications | null } | null)?.notifications?.telegramChatId ?? null
  },
}
