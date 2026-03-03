import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantMember, TenantRole } from '@fastio/shared'
import { query } from '~/utils/query'

const mapMember = (row: Record<string, unknown>): TenantMember => ({
  id: row.id as string,
  tenantId: row.tenant_id as string,
  userId: row.user_id as string,
  role: row.role as TenantRole,
  createdAt: row.created_at as string,
})

export const membersApi = {
  async listByUser(sb: SupabaseClient, userId: string) {
    const data = await query(
      sb.from('tenant_members')
        .select('*, tenants(id, name, slug)')
        .eq('user_id', userId),
    )

    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...mapMember(row),
      tenant: row.tenants as { id: string; name: string; slug: string } | null,
    }))
  },

  async updateRole(sb: SupabaseClient, memberId: string, role: TenantRole) {
    await query(sb.from('tenant_members').update({ role }).eq('id', memberId))
  },

  async remove(sb: SupabaseClient, memberId: string) {
    await query(sb.from('tenant_members').delete().eq('id', memberId))
  },
}
