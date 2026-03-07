import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantInvitation } from '@fastio/shared'
import { query } from '~/utils/query'
import type { TenantInvitationRow } from './db-types'

const mapInvitation = (raw: Record<string, unknown>): TenantInvitation => {
  const row = raw as TenantInvitationRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    role: row.role,
    invitedBy: row.invited_by,
    token: row.token,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    branchIds: row.branch_ids ?? [],
  }
}

export const invitationsApi = {
  async list(sb: SupabaseClient, tenantId: string) {
    const data = await query(
      sb.from('tenant_invitations')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    )

    return (data ?? []).map(mapInvitation)
  },

  async cancel(sb: SupabaseClient, invitationId: string) {
    await query(sb.from('tenant_invitations').delete().eq('id', invitationId))
  },
}
