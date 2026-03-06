import { computed, ref } from 'vue'
import { useNuxtApp } from '#imports'
import type { Order } from '@fastio/shared'
import { ordersApi, mapOrder, type OrderFilter } from '~/utils/api/orders'
import { useRealtimeList } from '~/composables/useRealtimeList'

export function useOrders(
  tenantId: Ref<string>,
  filter: Ref<OrderFilter>,
  branchId: Ref<string | null> = ref(null),
) {
  const { $supabase } = useNuxtApp()

  const { items: orders, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value && filter.value
      ? `orders:${tenantId.value}:${filter.value}:${branchId.value}`
      : null,
    ),
    table: 'orders',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => ordersApi.list($supabase, tenantId.value, filter.value!, branchId.value),
    mapper: mapOrder,
    shouldInclude: (order: Order) => filter.value !== null
      && order.status === filter.value
      && (branchId.value === null || order.branchId === branchId.value),
  })

  const updateStatus = async (orderId: string, status: string) => {
    await ordersApi.updateStatus($supabase, orderId, status)
    const i = orders.value.findIndex((o) => o.id === orderId)

    if (i === -1) return
    if (status !== filter.value) {
      orders.value.splice(i, 1)
    } else {
      orders.value[i] = { ...orders.value[i], status }
    }
  }

  return { orders, loading, updateStatus }
}
