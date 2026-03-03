import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantInvitation, TenantRole } from '@fastio/shared'

function mapInvitation(row: Record<string, unknown>): TenantInvitation {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string ?? row.tenant_id as string,
    email: row.email as string,
    role: row.role as TenantRole,
    invitedBy: row.invitedBy as string ?? row.invited_by as string,
    token: row.token as string,
    expiresAt: row.expiresAt as string ?? row.expires_at as string,
    acceptedAt: (row.acceptedAt ?? row.accepted_at ?? null) as string | null,
    createdAt: row.createdAt as string ?? row.created_at as string,
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
