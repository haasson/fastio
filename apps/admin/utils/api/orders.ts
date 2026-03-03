import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, OrderStatus } from '@fastio/shared'
import { query } from '~/utils/query'

export type OrderFilter = 'active' | 'completed' | 'cancelled' | 'all'

const activeStatuses: OrderStatus[] = ['new', 'accepted', 'cooking', 'ready', 'delivering']

const mapOrder = (row: Record<string, unknown>): Order => ({
  id: row.id as string,
  tenantId: row.tenant_id as string,
  customer: row.customer as Order['customer'],
  items: row.items as Order['items'],
  deliveryType: row.delivery_type as Order['deliveryType'],
  address: row.address as string | null,
  comment: row.comment as string | null,
  promoCode: row.promo_code as string | null,
  discountAmount: row.discount_amount as number,
  subtotal: row.subtotal as number,
  deliveryFee: row.delivery_fee as number,
  total: row.total as number,
  status: row.status as OrderStatus,
  paymentType: row.payment_type as Order['paymentType'],
  createdAt: row.created_at as string,
})

export const ordersApi = {
  async list(sb: SupabaseClient, tenantId: string, filter: OrderFilter) {
    let q = sb
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (filter === 'active') {
      q = q.in('status', activeStatuses)
    } else if (filter === 'completed') {
      q = q.eq('status', 'completed')
    } else if (filter === 'cancelled') {
      q = q.eq('status', 'cancelled')
    }

    const data = await query(q)

    return (data ?? []).map(mapOrder)
  },

  async updateStatus(sb: SupabaseClient, orderId: string, status: OrderStatus) {
    await query(sb.from('orders').update({ status }).eq('id', orderId))
  },
}
