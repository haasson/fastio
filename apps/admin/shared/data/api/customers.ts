import type { SupabaseClient } from '@supabase/supabase-js'

export const customersApi = {
  async count(sb: SupabaseClient, tenantId: string): Promise<number> {
    const { count } = await sb
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    return count ?? 0
  },
}
