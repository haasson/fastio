import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrderStatus } from '@fastio/shared'
import { query } from '~/utils/query'
import type { OrderStatusRow } from './db-types'

export const mapOrderStatus = (raw: Record<string, unknown>): OrderStatus => {
  const row = raw as OrderStatusRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    groupType: row.group_type,
    position: row.position,
  }
}

export const orderStatusesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<OrderStatus[]> {
    const data = await query(
      sb.from('order_statuses').select('*').eq('tenant_id', tenantId).order('position'),
    )

    return (data ?? []).map(mapOrderStatus)
  },

  async add(sb: SupabaseClient, tenantId: string, data: { name: string; groupType: OrderStatusGroup }): Promise<OrderStatus | null> {
    const existing = await query(
      sb.from('order_statuses').select('position').eq('tenant_id', tenantId).order('position', { ascending: false }).limit(1),
    )
    const nextPos = existing && existing.length > 0 ? (existing[0].position as number) + 1 : 0

    const result = await query(
      sb.from('order_statuses').insert({
        tenant_id: tenantId,
        name: data.name,
        group_type: data.groupType,
        position: nextPos,
      }).select().single(),
    )

    return result ? mapOrderStatus(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: { name: string; groupType: OrderStatusGroup }): Promise<OrderStatus | null> {
    const result = await query(
      sb.from('order_statuses').update({ name: data.name, group_type: data.groupType }).eq('id', id).select().single(),
    )

    return result ? mapOrderStatus(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('order_statuses').delete().eq('id', id))
  },

  async reorder(sb: SupabaseClient, items: { id: string; position: number }[]): Promise<void> {
    await Promise.all(
      items.map((item) => query(sb.from('order_statuses').update({ position: item.position }).eq('id', item.id)),
      ),
    )
  },
}
