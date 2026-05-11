import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCustomRole, RolePermissions } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import type { TenantRoleRow } from '~/shared/data/db-types'

const mapRole = (row: TenantRoleRow): TenantCustomRole => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  permissions: row.permissions,
  isDefault: row.is_default,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const rolesApi = {
  async list(sb: SupabaseClient, tenantId: string) {
    const data = await query(
      sb.from('tenant_roles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at'),
    )

    return (data ?? []).map((raw: Record<string, unknown>) => mapRole(raw as TenantRoleRow))
  },

  async create(sb: SupabaseClient, tenantId: string, name: string, permissions: RolePermissions) {
    const data = await query(
      sb.from('tenant_roles')
        .insert({ tenant_id: tenantId, name, permissions })
        .select()
        .single(),
    )

    return mapRole(data as TenantRoleRow)
  },

  async update(sb: SupabaseClient, roleId: string, data: { name?: string; permissions?: RolePermissions }) {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (data.name !== undefined) update.name = data.name
    if (data.permissions !== undefined) update.permissions = data.permissions

    await query(sb.from('tenant_roles').update(update).eq('id', roleId))
  },

  async remove(sb: SupabaseClient, roleId: string) {
    await query(sb.from('tenant_roles').delete().eq('id', roleId))
  },

  async countMembers(sb: SupabaseClient, roleId: string): Promise<number> {
    const { count } = await sb
      .from('tenant_members')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', roleId)

    return count ?? 0
  },
}
