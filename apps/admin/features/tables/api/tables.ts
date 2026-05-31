import type { SupabaseClient } from '@supabase/supabase-js'
import type { Table, TableFormData, TableShape, OrderItemModifier, OrderItemAddon } from '@fastio/shared'
import { orderItemKey } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import type { TableRow } from '~/shared/data/db-types'

export type TableSessionItem = {
  id: string | null
  dishId: string | null
  dishName: string
  categoryName: string | null
  quantity: number
  price: number
  modifiers: OrderItemModifier[]
  addons: OrderItemAddon[]
  removedIngredients: string[]
  status: 'pending' | 'confirmed'
}

export type TableSession = {
  sum: number
  count: number
  items: TableSessionItem[]
}

// Экспортируется для realtime-канала (useTablesChannel) — маппит payload строки.
export const mapTable = (raw: Record<string, unknown>): Table => {
  const row = raw as TableRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    isOpen: row.is_open,
    isActive: row.is_active,
    openedAt: row.opened_at,
    createdAt: row.created_at,
    capacity: row.capacity,
    tags: row.tags ?? [],
    positionX: row.position_x,
    positionY: row.position_y,
    shape: (row.shape as TableShape) ?? 'rectangle',
    tableWidth: row.table_width ?? 120,
    tableHeight: row.table_height ?? 80,
    rotation: row.rotation ?? 0,
    color: row.color,
    notes: row.notes,
  }
}

export const tablesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<Table[]> {
    const data = await query(
      sb.from('tables').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('created_at'),
    )

    return (data ?? []).map(mapTable)
  },

  async add(sb: SupabaseClient, tenantId: string, data: TableFormData): Promise<Table | null> {
    const result = await query(
      sb.from('tables').insert({
        tenant_id: tenantId,
        name: data.name,
        capacity: data.capacity ?? null,
        tags: data.tags ?? [],
        notes: data.notes ?? null,
        shape: data.shape ?? 'rectangle',
        table_width: data.tableWidth ?? 120,
        table_height: data.tableHeight ?? 80,
        position_x: data.positionX ?? null,
        position_y: data.positionY ?? null,
      }).select().single(),
    )

    return result ? mapTable(result) : null
  },

  async updateMeta(sb: SupabaseClient, id: string, data: Partial<TableFormData>): Promise<Table | null> {
    const patch: Record<string, unknown> = {}

    if (data.name !== undefined) patch.name = data.name
    if (data.capacity !== undefined) patch.capacity = data.capacity
    if (data.tags !== undefined) patch.tags = data.tags
    if (data.notes !== undefined) patch.notes = data.notes
    if (data.shape !== undefined) patch.shape = data.shape
    if (data.tableWidth !== undefined) patch.table_width = data.tableWidth
    if (data.tableHeight !== undefined) patch.table_height = data.tableHeight
    if (data.rotation !== undefined) patch.rotation = data.rotation
    if (data.color !== undefined) patch.color = data.color

    const result = await query(
      sb.from('tables').update(patch).eq('id', id).select().single(),
    )

    return result ? mapTable(result) : null
  },

  async setActive(sb: SupabaseClient, id: string, isActive: boolean): Promise<Table | null> {
    const result = await query(
      sb.from('tables')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single(),
    )

    return result ? mapTable(result) : null
  },

  async updatePosition(sb: SupabaseClient, id: string, x: number | null, y: number | null): Promise<void> {
    await query(sb.from('tables').update({ position_x: x, position_y: y }).eq('id', id))
  },

  async setOpen(sb: SupabaseClient, id: string, isOpen: boolean): Promise<Table | null> {
    const result = await query(
      sb.from('tables')
        .update({ is_open: isOpen, opened_at: isOpen ? new Date().toISOString() : null })
        .eq('id', id)
        .select()
        .single(),
    )

    return result ? mapTable(result) : null
  },

  async loadSums(sb: SupabaseClient, tables: Table[], cancelledStatusIds: string[]): Promise<Record<string, TableSession>> {
    const openTables = tables.filter((t) => t.isOpen && t.openedAt)

    if (!openTables.length) return {}

    const tableIds = openTables.map((t) => t.id)
    const earliestOpenedAt = openTables.map((t) => t.openedAt!).sort()[0]

    let q = sb.from('orders')
      .select('table_id, total, created_at, order_items(id, dish_id, dish_name, category_name, quantity, price, modifiers, addons, removed_ingredients, status)')
      .in('table_id', tableIds)
      .gte('created_at', earliestOpenedAt)

    if (cancelledStatusIds.length) {
      q = q.not('status', 'in', `(${cancelledStatusIds.join(',')})`)
    }

    type RawItem = {
      id: string
      dish_id: string | null
      dish_name: string
      category_name: string | null
      quantity: number
      price: number
      modifiers: OrderItemModifier[]
      addons: OrderItemAddon[]
      removed_ingredients: string[]
      status: 'pending' | 'confirmed'
    }

    type OrderWithItems = {
      table_id: string
      total: number
      created_at: string
      order_items: RawItem[]
    }

    const data = await query(q)
    const result: Record<string, TableSession> = {}

    const itemKey = (item: RawItem) => `${item.dish_name}::${orderItemKey(item.modifiers ?? [], item.addons ?? [], item.removed_ingredients ?? [])}`

    const itemKeyMaps = new Map<string, Map<string, TableSessionItem>>()

    for (const order of (data ?? []) as OrderWithItems[]) {
      const table = openTables.find((t) => t.id === order.table_id)

      if (!table?.openedAt || new Date(order.created_at) < new Date(table.openedAt)) continue

      result[order.table_id] ??= { sum: 0, count: 0, items: [] }
      result[order.table_id].sum += order.total
      result[order.table_id].count++

      if (!itemKeyMaps.has(order.table_id)) itemKeyMaps.set(order.table_id, new Map())
      const keyMap = itemKeyMaps.get(order.table_id)!

      for (const item of order.order_items ?? []) {
        if (item.status === 'pending') {
          // Pending items stay individual so they can be confirmed/rejected
          const pendingItem: TableSessionItem = {
            id: item.id,
            dishId: item.dish_id ?? null,
            dishName: item.dish_name,
            categoryName: item.category_name ?? null,
            quantity: item.quantity,
            price: item.price,
            modifiers: item.modifiers ?? [],
            addons: item.addons ?? [],
            removedIngredients: item.removed_ingredients ?? [],
            status: 'pending',
          }

          result[order.table_id].items.push(pendingItem)
        } else {
          const key = itemKey(item)
          const existing = keyMap.get(key)

          if (existing) {
            existing.quantity += item.quantity
          } else {
            const newItem: TableSessionItem = {
              id: null,
              dishId: item.dish_id ?? null,
              dishName: item.dish_name,
              categoryName: item.category_name ?? null,
              quantity: item.quantity,
              price: item.price,
              modifiers: item.modifiers ?? [],
              addons: item.addons ?? [],
              removedIngredients: item.removed_ingredients ?? [],
              status: 'confirmed',
            }

            keyMap.set(key, newItem)
            result[order.table_id].items.push(newItem)
          }
        }
      }
    }

    return result
  },

  async listTags(sb: SupabaseClient, tenantId: string): Promise<string[]> {
    const data = await query(
      sb.from('tables').select('tags').eq('tenant_id', tenantId).eq('is_active', true),
    )
    const all = (data ?? []).flatMap((row: { tags: string[] }) => row.tags ?? [])

    return [...new Set(all)].sort()
  },

  async applyDiscount(sb: SupabaseClient, tableId: string, openedAt: string, discountAmount: number, cancelledStatusIds: string[]): Promise<void> {
    if (discountAmount <= 0) return

    await query(sb.rpc('apply_table_discount', {
      p_table_id: tableId,
      p_opened_at: openedAt,
      p_discount_amount: discountAmount,
      p_cancelled_status_ids: cancelledStatusIds,
    }))
  },

  async archive(sb: SupabaseClient, id: string): Promise<void> {
    await query(
      sb.from('table_calls')
        .update({ resolved_at: new Date().toISOString() })
        .eq('table_id', id)
        .is('resolved_at', null),
    )
    await query(sb.from('tables').update({ is_active: false, is_open: false }).eq('id', id))
  },
}
