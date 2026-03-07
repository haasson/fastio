import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, OrderCustomer, OrderItem, OrderDeliveryType } from '@fastio/shared'
import { query } from '~/utils/query'
import type { OrderRow } from './db-types'
import { filterDefined } from '~/utils/filterDefined'

export type OrderUpdateData = {
  customer?: OrderCustomer
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
  paymentType?: string
}

export type OrderFilter = string | null

export const mapOrder = (raw: Record<string, unknown>): Order => {
  const row = raw as OrderRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    customer: row.customer,
    items: row.items,
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
    createdAt: row.created_at,
  }
}

export const ordersApi = {
  async list(sb: SupabaseClient, tenantId: string, filter: string, branchId: string | null = null) {
    let q = sb
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', filter)
      .order('created_at', { ascending: true })

    if (branchId !== null) {
      q = q.eq('branch_id', branchId)
    }

    const data = await query(q)

    return (data ?? []).map(mapOrder)
  },

  async update(sb: SupabaseClient, orderId: string, data: OrderUpdateData): Promise<Order | null> {
    const payload = filterDefined({
      customer: data.customer,
      items: data.items,
      delivery_type: data.deliveryType,
      address: data.address,
      comment: data.comment,
      promo_code: data.promoCode,
      discount_amount: data.discountAmount,
      subtotal: data.subtotal,
      delivery_fee: data.deliveryFee,
      total: data.total,
      status: data.status,
      payment_type: data.paymentType,
    }) as Partial<OrderRow>

    const result = await query(sb.from('orders').update(payload).eq('id', orderId).select().single())

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
}
