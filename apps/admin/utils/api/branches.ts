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
    color: row.color,
    address: row.address,
    phone: row.phone,
    isActive: row.is_active,
    workingHoursSchedule: row.working_hours_schedule,
    deliveryMinOrder: row.delivery_min_order,
    deliveryFee: row.delivery_fee,
    notifications: row.notifications,
    latitude: row.latitude,
    longitude: row.longitude,
    orderNumberPrefix: row.order_number_prefix ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? null,
  }
}

const branchToDb = (data: BranchFormData) => ({
  name: data.name,
  color: data.color,
  address: data.address,
  phone: data.phone,
  is_active: data.isActive,
  working_hours_schedule: data.workingHoursSchedule,
  delivery_min_order: data.deliveryMinOrder,
  delivery_fee: data.deliveryFee,
  notifications: data.notifications,
  latitude: data.latitude,
  longitude: data.longitude,
  order_number_prefix: data.orderNumberPrefix ?? null,
})

export const branchesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<Branch[]> {
    const data = await query(
      sb.from('branches').select('*').eq('tenant_id', tenantId).is('archived_at', null).order('created_at'),
    )

    return (data ?? []).map(mapBranch)
  },

  async listArchived(sb: SupabaseClient, tenantId: string): Promise<Branch[]> {
    const data = await query(
      sb.from('branches').select('*').eq('tenant_id', tenantId).not('archived_at', 'is', null).order('archived_at', { ascending: false }),
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
      color: data.color,
      address: data.address,
      phone: data.phone,
      is_active: data.isActive,
      working_hours_schedule: data.workingHoursSchedule,
      delivery_min_order: data.deliveryMinOrder,
      delivery_fee: data.deliveryFee,
      notifications: data.notifications,
      latitude: data.latitude,
      longitude: data.longitude,
      order_number_prefix: data.orderNumberPrefix,
    }) as Partial<BranchRow>

    const result = await query(sb.from('branches').update(payload).eq('id', id).select().single())

    return result ? mapBranch(result) : null
  },

  async archive(sb: SupabaseClient, id: string): Promise<Branch | null> {
    const result = await query(
      sb.from('branches').update({ archived_at: new Date().toISOString() }).eq('id', id).select().single(),
    )

    return result ? mapBranch(result) : null
  },

  async restore(sb: SupabaseClient, id: string): Promise<Branch | null> {
    const result = await query(
      sb.from('branches').update({ archived_at: null }).eq('id', id).select().single(),
    )

    return result ? mapBranch(result) : null
  },

  async hasActiveOrders(sb: SupabaseClient, branchId: string, tenantId: string): Promise<boolean> {
    const { data: statuses } = await sb
      .from('order_statuses')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('group_type', ['new', 'in_progress'])

    if (!statuses || statuses.length === 0) return false

    const statusIds = statuses.map((s: { id: string }) => s.id)
    const { count } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .in('status', statusIds)

    return (count ?? 0) > 0
  },
}
