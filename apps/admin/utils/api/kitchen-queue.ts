import type { SupabaseClient } from '@supabase/supabase-js'
import type { KitchenQueueItem } from '@fastio/shared'
import { query } from '~/utils/query'
import type { KitchenQueueRow } from './db-types'

/** Realtime events don't include joined data, so orderNumber arrives as null.
 *  Merge with the existing item to preserve the value from the initial REST load. */
export const mergeRealtimeItem = (incoming: KitchenQueueItem, existing: KitchenQueueItem): KitchenQueueItem => ({
  ...incoming,
  orderNumber: incoming.orderNumber ?? existing.orderNumber,
})

export const mapKitchenQueueItem = (raw: Record<string, unknown>): KitchenQueueItem => {
  const row = raw as KitchenQueueRow

  const orders = (raw as Record<string, unknown>).orders as { order_number: string | null } | null

  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    orderNumber: orders?.order_number ?? null,
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
    servedBy: row.served_by ?? null,
    dismissedAt: row.dismissed_at,
    skipKitchen: row.skip_kitchen,
    createdAt: row.created_at,
  }
}

export const kitchenQueueApi = {
  async listActive(sb: SupabaseClient, tenantId: string): Promise<KitchenQueueItem[]> {
    const data = await query(
      sb.from('kitchen_queue')
        .select('*, orders(order_number)')
        .eq('tenant_id', tenantId)
        .eq('skip_kitchen', false)
        .in('status', ['queued', 'in_progress', 'cancelled'])
        .order('created_at', { ascending: true }),
    )

    // Cancelled that were already dismissed — no need to show
    return (data ?? []).map(mapKitchenQueueItem).filter((i) => !(i.status === 'cancelled' && i.dismissedAt))
  },

  async listForAssembly(sb: SupabaseClient, tenantId: string): Promise<KitchenQueueItem[]> {
    const data = await query(
      sb.from('kitchen_queue')
        .select('*, orders(order_number)')
        .eq('tenant_id', tenantId)
        .neq('delivery_type', 'dine_in')
        .in('status', ['queued', 'in_progress', 'done', 'cancelled'])
        .order('created_at', { ascending: true }),
    )

    return (data ?? []).map(mapKitchenQueueItem).filter((i) => !(i.status === 'cancelled' && i.dismissedAt))
  },

  async listActiveForTable(sb: SupabaseClient, tenantId: string, tableIds: string[]): Promise<(KitchenQueueItem & { tableId: string })[]> {
    if (!tableIds.length) return []

    const data = await query(
      sb.from('kitchen_queue')
        .select('*, orders!inner(order_number, table_id)')
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

  async dismissCancelled(sb: SupabaseClient, id: string): Promise<void> {
    await query(
      sb.from('kitchen_queue')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'cancelled'),
    )
  },

  async dismissCancelledOrder(sb: SupabaseClient, orderId: string): Promise<void> {
    await query(
      sb.from('kitchen_queue')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .eq('status', 'cancelled'),
    )
  },

  async uncollect(sb: SupabaseClient, id: string): Promise<void> {
    await query(
      sb.from('kitchen_queue')
        .update({ status: 'queued', completed_at: null })
        .eq('id', id),
    )
  },

  async markServed(sb: SupabaseClient, id: string, userId: string): Promise<void> {
    await query(
      sb.from('kitchen_queue')
        .update({ status: 'served', served_at: new Date().toISOString(), served_by: userId })
        .eq('id', id),
    )
  },

  async cancelForOrders(sb: SupabaseClient, orderIds: string[]): Promise<void> {
    if (!orderIds.length) return

    await query(
      sb.from('kitchen_queue')
        .update({ status: 'cancelled' })
        .in('order_id', orderIds)
        .in('status', ['queued', 'in_progress']),
    )
  },

  async serveAllForOrders(sb: SupabaseClient, orderIds: string[], userId: string): Promise<void> {
    if (!orderIds.length) return
    const now = new Date().toISOString()

    await query(
      sb.from('kitchen_queue')
        .update({ status: 'served', served_at: now, served_by: userId })
        .in('order_id', orderIds)
        .in('status', ['queued', 'in_progress', 'done']),
    )
  },
}
