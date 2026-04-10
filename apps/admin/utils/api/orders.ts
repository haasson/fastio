import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, OrderItem, OrderDeliveryType, OrderItemModifier, OrderItemAddon } from '@fastio/shared'
import { normalizePhone, orderItemKey } from '@fastio/shared'
import { query } from '~/utils/query'
import type { OrderRow, OrderItemRow } from './db-types'
import { filterDefined } from '~/utils/filterDefined'

const ORDER_SELECT = '*, order_items(*)' as const

export type OrderUpdateData = {
  customerName?: string
  customerPhone?: string
  customerEmail?: string | null
  items?: OrderItem[]
  deliveryType?: OrderDeliveryType
  address?: string | null
  comment?: string | null
  promoCode?: string | null
  discountAmount?: number
  subtotal?: number
  deliveryFee?: number
  total?: number
  status?: string
  paymentType?: 'cash' | 'card' | 'online'
  branchId?: string | null
}

export type OrderCreateData = {
  tenantId: string
  branchId: string | null
  customerName: string | null
  customerPhone: string
  customerEmail?: string | null
  items: OrderItem[]
  deliveryType: OrderDeliveryType
  address: string | null
  comment: string | null
  promoCode: string | null
  discountAmount: number
  subtotal: number
  deliveryFee: number
  total: number
  status: string
  paymentType: 'cash' | 'card' | 'online'
  tableId?: string | null
  tableName?: string | null
  idempotencyKey?: string | null
}

export type OrderFilter = string | null

const mapOrderItem = (row: OrderItemRow): OrderItem => ({
  id: row.id,
  orderId: row.order_id,
  dishId: row.dish_id,
  comboId: row.combo_id,
  dishName: row.dish_name,
  categoryName: row.category_name,
  price: row.price,
  quantity: row.quantity,
  removedIngredients: row.removed_ingredients ?? [],
  modifiers: row.modifiers ?? [],
  addons: row.addons ?? [],
  sortOrder: row.sort_order,
  completedAt: row.completed_at ?? null,
  comboItems: row.combo_items ?? null,
  addedBy: row.added_by ?? null,
  confirmedBy: row.confirmed_by ?? null,
  status: row.status ?? 'confirmed',
})

export const mapOrder = (raw: Record<string, unknown>): Order => {
  const row = raw as OrderRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    items: (row.order_items ?? []).map(mapOrderItem),
    deliveryType: row.delivery_type,
    address: row.address,
    comment: row.comment,
    promoCode: row.promo_code,
    discountAmount: row.discount_amount,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
    status: row.status,
    statusGroup: (raw as Record<string, unknown>).statusGroup as Order['statusGroup'] ?? null,
    statusName: (raw as Record<string, unknown>).statusName as string ?? null,
    paymentType: row.payment_type,
    branchId: row.branch_id,
    branchAddress: row.branch_address ?? null,
    deliveryZoneId: row.delivery_zone_id,
    tableId: row.table_id,
    tableName: row.table_name,
    orderNumber: row.order_number ?? null,
    acceptedBy: row.accepted_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const toOrderPayload = (data: OrderUpdateData | OrderCreateData): Partial<OrderRow> => filterDefined({
  customer_name: data.customerName,
  customer_phone: data.customerPhone,
  customer_email: data.customerEmail,
  delivery_type: data.deliveryType,
  address: data.address,
  comment: data.comment,
  promo_code: data.promoCode,
  discount_amount: data.discountAmount,
  subtotal: data.subtotal,
  delivery_fee: data.deliveryFee,
  total: data.total,
  branch_id: data.branchId,
  status: data.status,
  payment_type: data.paymentType,
}) as Partial<OrderRow>

const toItemRows = (orderId: string, items: OrderItem[]): Omit<OrderItemRow, 'id'>[] => items.map((item, i) => ({
  order_id: orderId,
  dish_id: item.dishId,
  combo_id: item.comboId ?? null,
  dish_name: item.dishName,
  category_name: item.categoryName ?? null,
  price: item.price,
  quantity: item.quantity,
  removed_ingredients: item.removedIngredients,
  modifiers: item.modifiers ?? [],
  addons: item.addons ?? [],
  sort_order: i,
  completed_at: item.completedAt ?? null,
  combo_items: item.comboItems ?? null,
  added_by: item.addedBy ?? null,
  confirmed_by: item.confirmedBy ?? null,
  status: item.status ?? 'confirmed',
}))

export const DEFAULT_PAGE_SIZE = 10

const SORTABLE_COLUMNS = new Set(['created_at', 'total'])

export type OrderListOptions = {
  branchId?: string | null
  filterBranchIds?: string[]
  page?: number
  pageSize?: number
  search?: string
  statusIds?: string[]
  deliveryTypes?: string[]
  excludeDeliveryTypes?: string[]
  paymentTypes?: string[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export const ordersApi = {
  async list(
    sb: SupabaseClient,
    tenantId: string,
    filter: string | null,
    options: OrderListOptions = {},
  ) {
    const {
      branchId = null,
      filterBranchIds = [],
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
      search,
      statusIds = [],
      deliveryTypes = [],
      excludeDeliveryTypes = [],
      paymentTypes = [],
      sortBy = 'created_at',
      sortDir = 'desc',
    } = options

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const safeSort = SORTABLE_COLUMNS.has(sortBy) ? sortBy : 'created_at'

    let q = sb
      .from('orders')
      .select(ORDER_SELECT, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order(safeSort, { ascending: sortDir === 'asc' })
      .range(from, to)

    if (statusIds.length > 0) {
      q = q.in('status', statusIds)
    } else if (filter) {
      q = q.eq('status', filter)
    }

    if (filterBranchIds.length > 0) {
      q = q.in('branch_id', filterBranchIds)
    } else if (branchId !== null) {
      q = q.eq('branch_id', branchId)
    }

    if (search) {
      const phoneDigits = normalizePhone(search)
      const phonePart = phoneDigits.length >= 3
        ? `customer_phone.ilike.%${phoneDigits}%`
        : `customer_phone.ilike.%${search}%`

      q = q.or(`customer_name.ilike.%${search}%,${phonePart}`)
    }

    if (deliveryTypes.length > 0) {
      q = q.in('delivery_type', deliveryTypes)
    } else if (excludeDeliveryTypes.length > 0) {
      q = q.not('delivery_type', 'in', `(${excludeDeliveryTypes.join(',')})`)
    }

    if (paymentTypes.length > 0) {
      q = q.in('payment_type', paymentTypes)
    }

    const { data, error, count } = await q

    if (error) {
      console.error('[Supabase]', error.message, error)
      throw new Error(error.message)
    }

    return {
      orders: (data ?? []).map(mapOrder),
      total: count ?? 0,
    }
  },

  async update(sb: SupabaseClient, orderId: string, data: OrderUpdateData): Promise<Order | null> {
    // Re-insert items BEFORE updating order fields so that the kitchen_queue
    // trigger (which fires on status change) references the new order_item IDs.
    // Otherwise CASCADE on order_item_id deletes the just-created queue rows.
    if (data.items) {
      await query(sb.from('order_items').delete().eq('order_id', orderId))
      const rows = toItemRows(orderId, data.items)

      if (rows.length > 0) {
        await query(sb.from('order_items').insert(rows))
      }
    }

    const payload = toOrderPayload(data)

    if (Object.keys(payload).length > 0) {
      await query(sb.from('orders').update(payload).eq('id', orderId))
    }

    const result = await query(
      sb.from('orders').select(ORDER_SELECT).eq('id', orderId).single(),
    )

    return result ? mapOrder(result) : null
  },

  async counts(sb: SupabaseClient, tenantId: string, branchId: string | null = null, excludeDeliveryTypes: string[] = []) {
    let q = sb.from('orders').select('status').eq('tenant_id', tenantId)

    if (branchId !== null) q = q.eq('branch_id', branchId)
    if (excludeDeliveryTypes.length > 0) {
      q = q.not('delivery_type', 'in', `(${excludeDeliveryTypes.join(',')})`)
    }
    const data = await query(q)

    return (data ?? []).reduce<Record<string, number>>((acc, row) => {
      const s = (row as Pick<OrderRow, 'status'>).status

      acc[s] = (acc[s] ?? 0) + 1

      return acc
    }, {})
  },

  async listIdsForTable(sb: SupabaseClient, tableId: string, excludeStatusIds: string[]): Promise<string[]> {
    let q = sb.from('orders').select('id').eq('table_id', tableId)

    if (excludeStatusIds.length) {
      q = q.not('status', 'in', `(${excludeStatusIds.join(',')})`)
    }

    const data = await query(q)

    return (data ?? []).map((row) => (row as { id: string }).id)
  },

  async findTableItem(
    sb: SupabaseClient,
    tableId: string,
    match: { dishName: string; modifiers: OrderItemModifier[]; addons: OrderItemAddon[]; removedIngredients: string[] },
    excludeStatusIds: string[],
  ): Promise<{ id: string; orderId: string } | null> {
    let q = sb
      .from('order_items')
      .select('id, order_id, modifiers, addons, removed_ingredients, orders!inner(table_id, status)')
      .eq('dish_name', match.dishName)
      .eq('orders.table_id', tableId)

    if (excludeStatusIds.length) {
      q = q.not('orders.status', 'in', `(${excludeStatusIds.join(',')})`)
    }

    const data = await query(q)

    type Row = { id: string; order_id: string; modifiers: OrderItemModifier[]; addons: OrderItemAddon[]; removed_ingredients: string[] }

    const targetKey = orderItemKey(match.modifiers, match.addons, match.removedIngredients)
    const row = (data ?? []).find((r) => {
      const item = r as Row

      return orderItemKey(item.modifiers ?? [], item.addons ?? [], item.removed_ingredients ?? []) === targetKey
    }) as Row | undefined

    return row ? { id: row.id, orderId: row.order_id } : null
  },

  async removeItem(sb: SupabaseClient, orderItemId: string, orderId: string): Promise<void> {
    // Delete order_item (kitchen_queue cascades via ON DELETE CASCADE)
    await query(sb.from('order_items').delete().eq('id', orderItemId))

    // If order has no items left, delete it
    const remaining = await query(
      sb.from('order_items').select('id').eq('order_id', orderId).limit(1),
    )

    if (!remaining?.length) {
      await query(sb.from('orders').delete().eq('id', orderId))
    }
  },

  async updateStatus(sb: SupabaseClient, orderId: string, status: string) {
    await query(sb.from('orders').update({ status }).eq('id', orderId))
  },

  async create(sb: SupabaseClient, data: OrderCreateData): Promise<Order | null> {
    const result = await query(
      sb.from('orders').insert({
        ...toOrderPayload(data),
        tenant_id: data.tenantId,
        branch_id: data.branchId,
        ...(data.tableId ? { table_id: data.tableId, table_name: data.tableName ?? null } : {}),
        ...(data.idempotencyKey ? { idempotency_key: data.idempotencyKey } : {}),
      }).select().single(),
    )

    if (!result) return null

    const orderId = (result as { id: string }).id
    const itemRows = toItemRows(orderId, data.items)

    if (itemRows.length > 0) {
      await query(sb.from('order_items').insert(itemRows))
    }

    const full = await query(
      sb.from('orders').select(ORDER_SELECT).eq('id', orderId).single(),
    )

    return full ? mapOrder(full) : null
  },

  async getById(sb: SupabaseClient, orderId: string): Promise<Order | null> {
    const result = await query(
      sb.from('orders').select(ORDER_SELECT).eq('id', orderId).single(),
    )

    return result ? mapOrder(result) : null
  },

  async getStatsForPeriod(
    sb: SupabaseClient,
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    branchId: string | null = null,
  ): Promise<Array<{ id: string; total: number; createdAt: string; deliveryType: OrderDeliveryType; items: Array<{ dishName: string; quantity: number; categoryName: string | null }> }>> {
    let q = sb
      .from('orders')
      .select('id, total, created_at, delivery_type, order_items(dish_name, quantity, category_name)')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)

    if (branchId !== null) q = q.eq('branch_id', branchId)

    const { data, error } = await q

    if (error) {
      console.error('[Supabase]', error.message, error)
      throw new Error(error.message)
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      total: row.total as number,
      createdAt: row.created_at as string,
      deliveryType: row.delivery_type as OrderDeliveryType,
      items: ((row.order_items as Array<{ dish_name: string; quantity: number; category_name: string | null }>) ?? []).map((i) => ({
        dishName: i.dish_name,
        quantity: i.quantity,
        categoryName: i.category_name ?? null,
      })),
    }))
  },

  async confirmItem(sb: SupabaseClient, itemId: string, userId: string): Promise<void> {
    await query(
      sb.from('order_items')
        .update({ status: 'confirmed', confirmed_by: userId })
        .eq('id', itemId)
        .eq('status', 'pending'),
    )
  },

  async rejectItem(sb: SupabaseClient, itemId: string): Promise<void> {
    await query(
      sb.from('order_items')
        .delete()
        .eq('id', itemId)
        .eq('status', 'pending'),
    )
  },

  async confirmAllPendingItems(sb: SupabaseClient, tableId: string, userId: string, cancelledStatusIds: string[]): Promise<void> {
    let q = sb.from('orders').select('id').eq('table_id', tableId)

    if (cancelledStatusIds.length) {
      q = q.not('status', 'in', `(${cancelledStatusIds.join(',')})`)
    }

    const orders = await query(q)

    if (!orders?.length) return

    const orderIds = orders.map((o: { id: string }) => o.id)

    await query(
      sb.from('order_items')
        .update({ status: 'confirmed', confirmed_by: userId })
        .eq('status', 'pending')
        .in('order_id', orderIds),
    )
  },
}
