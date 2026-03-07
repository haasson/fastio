import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantMember, TenantRole } from '@fastio/shared'
import { query } from '~/utils/query'
import type { TenantMemberRow } from './db-types'

const mapMember = (raw: Record<string, unknown>): TenantMember => {
  const row = raw as TenantMemberRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    role: row.role,
    branchIds: row.branch_ids ?? [],
    createdAt: row.created_at,
  }
}

export const membersApi = {
  async listByUser(sb: SupabaseClient, userId: string) {
    const data = await query(
      sb.from('tenant_members')
        .select('*, tenants(id, name, slug)')
        .eq('user_id', userId),
    )

    return (data ?? []).map((raw: Record<string, unknown>) => {
      const row = raw as TenantMemberRow

      return { ...mapMember(raw), tenant: row.tenants ?? null }
    })
  },

  async updateRole(sb: SupabaseClient, memberId: string, role: TenantRole) {
    await query(sb.from('tenant_members').update({ role }).eq('id', memberId))
  },

  async updateBranchIds(sb: SupabaseClient, memberId: string, branchIds: string[]) {
    await query(sb.from('tenant_members').update({ branch_ids: branchIds }).eq('id', memberId))
  },

  async updateRoleAndBranches(sb: SupabaseClient, memberId: string, role: TenantRole, branchIds: string[]) {
    await query(sb.from('tenant_members').update({ role, branch_ids: branchIds }).eq('id', memberId))
  },

  async block(sb: SupabaseClient, memberId: string, blockedUntil: string) {
    await query(sb.from('tenant_members').update({ blocked_until: blockedUntil }).eq('id', memberId))
  },

  async unblock(sb: SupabaseClient, memberId: string) {
    await query(sb.from('tenant_members').update({ blocked_until: null }).eq('id', memberId))
  },

  async remove(sb: SupabaseClient, memberId: string) {
    await query(sb.from('tenant_members').delete().eq('id', memberId))
  },
}
