import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Order, OrderStatus } from '@fastio/shared'

// Следующий статус по флоу + лейбл кнопки
// // TODO:  конфиги здесь и в других местах вынести в конфиги
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

// // TODO: а почему это вообще композаблы, а не стор? Есть причины для такого?
export function useOrders(tenantId: Ref<string>, filter: Ref<OrderFilter>) {
  const { $supabase } = useNuxtApp()
  const orders = ref<Order[]>([])
  const loading = ref(true)

  let channel: RealtimeChannel | null = null

  async function fetchOrders(tid: string, f: OrderFilter) {
    loading.value = true
    orders.value = await ordersApi.list($supabase, tid, f)
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
    await ordersApi.updateStatus($supabase, orderId, status)
  }

  async function cancel(orderId: string) {
    await updateStatus(orderId, 'cancelled')
  }

  return { orders, loading, updateStatus, cancel }
}
