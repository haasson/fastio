import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, OrderItem, OrderDeliveryType } from '@fastio/shared'
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
  customerName: string
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
  sortOrder: row.sort_order,
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
    paymentType: row.payment_type,
    branchId: row.branch_id,
    deliveryZoneId: row.delivery_zone_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const toOrderPayload = (data: OrderUpdateData): Partial<OrderRow> => filterDefined({
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
  sort_order: i,
}))

export const PAGE_SIZE = 50

export const ordersApi = {
  async list(
    sb: SupabaseClient,
    tenantId: string,
    filter: string,
    branchId: string | null = null,
    page = 1,
  ) {
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let q = sb
      .from('orders')
      .select(ORDER_SELECT, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('status', filter)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (branchId !== null) {
      q = q.eq('branch_id', branchId)
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
    const payload = toOrderPayload(data)

    if (Object.keys(payload).length > 0) {
      await query(sb.from('orders').update(payload).eq('id', orderId))
    }

    if (data.items) {
      await query(sb.from('order_items').delete().eq('order_id', orderId))
      const rows = toItemRows(orderId, data.items)

      if (rows.length > 0) {
        await query(sb.from('order_items').insert(rows))
      }
    }

    const result = await query(
      sb.from('orders').select(ORDER_SELECT).eq('id', orderId).single(),
    )

    return result ? mapOrder(result) : null
  },

  async counts(sb: SupabaseClient, tenantId: string, branchId: string | null = null) {
    let q = sb.from('orders').select('status').eq('tenant_id', tenantId)

    if (branchId !== null) q = q.eq('branch_id', branchId)
    const data = await query(q)

    return (data ?? []).reduce<Record<string, number>>((acc, row) => {
      const s = (row as Pick<OrderRow, 'status'>).status

      acc[s] = (acc[s] ?? 0) + 1

      return acc
    }, {})
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
}
