import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantInvitation } from '@fastio/shared'
import { query } from '~/utils/query'
import type { TenantInvitationRow } from './db-types'

const mapInvitation = (raw: Record<string, unknown>): TenantInvitation => {
  const row = raw as TenantInvitationRow
  const role = row.tenant_roles

  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    roleId: row.role_id ?? null,
    roleName: role?.name ?? null,
    invitedBy: row.invited_by,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    branchIds: row.branch_ids ?? [],
  }
}

// Явный список колонок вместо `*` — `tenant_invitations.token` не попадает
// в client payload даже если кто-то добавит соседнее чувствительное поле в схему.
const INVITATION_COLUMNS
  = 'id, tenant_id, email, role_id, invited_by, expires_at, accepted_at, created_at, branch_ids, tenant_roles(id, name)'

export const invitationsApi = {
  async list(sb: SupabaseClient, tenantId: string) {
    const data = await query(
      sb.from('tenant_invitations')
        .select(INVITATION_COLUMNS)
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
