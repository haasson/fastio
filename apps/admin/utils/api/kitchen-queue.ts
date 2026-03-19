import type { SupabaseClient } from '@supabase/supabase-js'
import type { KitchenQueueItem } from '@fastio/shared'
import { query } from '~/utils/query'
import type { KitchenQueueRow } from './db-types'

export const mapKitchenQueueItem = (raw: Record<string, unknown>): KitchenQueueItem => {
  const row = raw as KitchenQueueRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    dishName: row.dish_name,
    dishId: row.dish_id,
    comboId: row.combo_id,
    comboName: row.combo_name,
    categoryName: row.category_name,
    modifiers: row.modifiers ?? [],
    addons: row.addons ?? [],
    removedIngredients: row.removed_ingredients ?? [],
    deliveryType: row.delivery_type,
    status: row.status,
    assignedTo: row.assigned_to,
    assignedAt: row.assigned_at,
    completedAt: row.completed_at,
    servedAt: row.served_at,
    createdAt: row.created_at,
  }
}

export const kitchenQueueApi = {
  async listActive(sb: SupabaseClient, tenantId: string): Promise<KitchenQueueItem[]> {
    const data = await query(
      sb.from('kitchen_queue')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['queued', 'in_progress'])
        .order('created_at', { ascending: true }),
    )

    return (data ?? []).map(mapKitchenQueueItem)
  },

  async listForAssembly(sb: SupabaseClient, tenantId: string): Promise<KitchenQueueItem[]> {
    const data = await query(
      sb.from('kitchen_queue')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['queued', 'in_progress', 'done'])
        .order('created_at', { ascending: true }),
    )

    return (data ?? []).map(mapKitchenQueueItem)
  },

  async listActiveForTable(sb: SupabaseClient, tenantId: string, tableIds: string[]): Promise<(KitchenQueueItem & { tableId: string })[]> {
    if (!tableIds.length) return []

    const data = await query(
      sb.from('kitchen_queue')
        .select('*, orders!inner(table_id)')
        .eq('tenant_id', tenantId)
        .in('status', ['queued', 'in_progress', 'done'])
        .eq('delivery_type', 'dine_in')
        .in('orders.table_id', tableIds)
        .order('created_at', { ascending: true }),
    )

    return (data ?? []).map((row) => ({
      ...mapKitchenQueueItem(row),
      tableId: (row as { orders: { table_id: string } }).orders.table_id,
    }))
  },

  async claim(sb: SupabaseClient, id: string, userId: string): Promise<void> {
    await query(
      sb.from('kitchen_queue')
        .update({ status: 'in_progress', assigned_to: userId, assigned_at: new Date().toISOString() })
        .eq('id', id),
    )
  },

  async complete(sb: SupabaseClient, id: string): Promise<void> {
    await query(
      sb.from('kitchen_queue')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', id),
    )
  },

  async unclaim(sb: SupabaseClient, id: string): Promise<void> {
    await query(
      sb.from('kitchen_queue')
        .update({ status: 'queued', assigned_to: null, assigned_at: null })
        .eq('id', id),
    )
  },

  async markServed(sb: SupabaseClient, id: string): Promise<void> {
    await query(
      sb.from('kitchen_queue')
        .update({ status: 'served', served_at: new Date().toISOString() })
        .eq('id', id),
    )
  },
}
