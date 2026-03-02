import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Order, OrderStatus } from '@fastfood-saas/shared'

export type OrderFilter = 'active' | 'completed' | 'cancelled' | 'all'

// Следующий статус по флоу + лейбл кнопки
export const nextStatus: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: 'accepted', label: 'Принять' },
  accepted: { status: 'cooking', label: 'Готовится' },
  cooking: { status: 'ready', label: 'Готово' },
  ready: { status: 'delivering', label: 'Передать курьеру' },
  delivering: { status: 'completed', label: 'Доставлен' },
}

export const nextStatusPickup: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  ...nextStatus,
  ready: { status: 'completed', label: 'Выдать' },
}

export const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  new: { label: 'Новый', color: '#3b82f6' },
  accepted: { label: 'Принят', color: '#8b5cf6' },
  cooking: { label: 'Готовится', color: '#f59e0b' },
  ready: { label: 'Готов', color: '#10b981' },
  delivering: { label: 'Доставляется', color: '#06b6d4' },
  completed: { label: 'Завершён', color: '#6b7280' },
  cancelled: { label: 'Отменён', color: '#ef4444' },
}

const activeStatuses: OrderStatus[] = ['new', 'accepted', 'cooking', 'ready', 'delivering']

function mapOrder(row: Record<string, unknown>): Order {
  return {
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
  }
}

export function useOrders(tenantId: Ref<string>, filter: Ref<OrderFilter>) {
  const { $supabase } = useNuxtApp()
  const orders = ref<Order[]>([])
  const loading = ref(true)

  let channel: RealtimeChannel | null = null

  async function fetchOrders(tid: string, f: OrderFilter) {
    loading.value = true

    let q = $supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tid)
      .order('created_at', { ascending: false })

    if (f === 'active') {
      q = q.in('status', activeStatuses)
    } else if (f === 'completed') {
      q = q.eq('status', 'completed')
    } else if (f === 'cancelled') {
      q = q.eq('status', 'cancelled')
    }

    const { data } = await q
    orders.value = (data ?? []).map(mapOrder)
    loading.value = false
  }

  watch(
    [tenantId, filter],
    ([tid, f]) => {
      channel?.unsubscribe()
      channel = null
      orders.value = []

      if (!tid) return

      fetchOrders(tid, f)

      channel = $supabase
        .channel(`orders:${tid}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tid}`,
        }, () => fetchOrders(tid, f))
        .subscribe()
    },
    { immediate: true },
  )

  onUnmounted(() => channel?.unsubscribe())

  async function updateStatus(orderId: string, status: OrderStatus) {
    await $supabase.from('orders').update({ status }).eq('id', orderId)
  }

  async function cancel(orderId: string) {
    await updateStatus(orderId, 'cancelled')
  }

  return { orders, loading, updateStatus, cancel }
}
