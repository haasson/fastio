import type { SupabaseClient } from '@supabase/supabase-js'
import type { Branch, BranchFormData } from '@fastio/shared'
import { query } from '~/utils/query'
import type { BranchRow } from './db-types'
import { filterDefined } from '~/utils/filterDefined'

export const mapBranch = (raw: Record<string, unknown>): Branch => {
  const row = raw as BranchRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    isActive: row.is_active,
    workingHours: row.working_hours,
    deliveryMinOrder: row.delivery_min_order,
    deliveryFee: row.delivery_fee,
    notifications: row.notifications,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const branchToDb = (data: BranchFormData) => ({
  name: data.name,
  address: data.address,
  phone: data.phone,
  is_active: data.isActive,
  working_hours: data.workingHours,
  delivery_min_order: data.deliveryMinOrder,
  delivery_fee: data.deliveryFee,
  notifications: data.notifications,
})

export const branchesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<Branch[]> {
    const data = await query(
      sb.from('branches').select('*').eq('tenant_id', tenantId).order('created_at'),
    )

    return (data ?? []).map(mapBranch)
  },

  async add(sb: SupabaseClient, tenantId: string, data: BranchFormData): Promise<Branch | null> {
    const result = await query(
      sb.from('branches').insert({ tenant_id: tenantId, ...branchToDb(data) }).select().single(),
    )

    return result ? mapBranch(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<BranchFormData>): Promise<Branch | null> {
    const payload = filterDefined({
      name: data.name,
      address: data.address,
      phone: data.phone,
      is_active: data.isActive,
      working_hours: data.workingHours,
      delivery_min_order: data.deliveryMinOrder,
      delivery_fee: data.deliveryFee,
      notifications: data.notifications,
    }) as Partial<BranchRow>

    const result = await query(sb.from('branches').update(payload).eq('id', id).select().single())

    return result ? mapBranch(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('branches').delete().eq('id', id))
  },
}
