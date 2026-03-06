import { computed, ref } from 'vue'
import type { Order } from '@fastio/shared'
import { mapOrder, type OrderFilter } from '~/utils/api/orders'
import { useRealtimeList } from '~/composables/useRealtimeList'
import { useSupabaseApi } from '~/composables/useSupabaseApi'

export function useOrders(
  tenantId: Ref<string>,
  filter: Ref<OrderFilter>,
  branchId: Ref<string | null> = ref(null),
) {
  const api = useSupabaseApi()

  const { items: orders, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value && filter.value
      ? `orders:${tenantId.value}:${filter.value}:${branchId.value}`
      : null,
    ),
    table: 'orders',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.orders.list(tenantId.value, filter.value!, branchId.value),
    mapper: mapOrder,
    shouldInclude: (order: Order) => filter.value !== null
      && order.status === filter.value
      && (branchId.value === null || order.branchId === branchId.value),
  })

  const updateStatus = async (orderId: string, status: string) => {
    await api.orders.updateStatus(orderId, status)
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
