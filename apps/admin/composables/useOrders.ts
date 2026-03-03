import { ref, watch, onUnmounted } from 'vue'
import { useNuxtApp } from '#imports'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Order, OrderStatus } from '@fastio/shared'
import { ordersApi, type OrderFilter } from '~/utils/api/orders'

export function useOrders(tenantId: Ref<string>, filter: Ref<OrderFilter>) {
  const { $supabase } = useNuxtApp()
  const orders = ref<Order[]>([])
  const loading = ref(true)

  let channel: RealtimeChannel | null = null

  const fetchOrders = async (tid: string, f: OrderFilter) => {
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

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    await ordersApi.updateStatus($supabase, orderId, status)
  }

  const cancel = async (orderId: string) => {
    await updateStatus(orderId, 'cancelled')
  }

  return { orders, loading, updateStatus, cancel }
}
