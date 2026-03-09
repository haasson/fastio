import { computed, type Ref } from 'vue'
import type { OrderStatus, OrderStatusData } from '@fastio/shared'
import { mapOrderStatus } from '~/utils/api/order-statuses'
import { useRealtimeList } from '~/composables/useRealtimeList'
import { useDatabase } from '~/composables/useDatabase'

export const useOrderStatuses = (tenantId: Ref<string>) => {
  const api = useDatabase()

  const { items: statuses, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `order_statuses:${tenantId.value}` : null),
    table: 'order_statuses',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.orderStatuses.list(tenantId.value),
    mapper: mapOrderStatus,
  })

  const add = async (data: Required<Pick<OrderStatusData, 'name' | 'groupType'>> & OrderStatusData) => {
    if (!tenantId.value) return
    const status = await api.orderStatuses.add(tenantId.value, data)

    if (status) statuses.value.push(status)
  }

  const update = async (id: string, data: OrderStatusData) => {
    const updated = await api.orderStatuses.update(id, data)

    if (updated) {
      const i = statuses.value.findIndex((s) => s.id === id)

      if (i !== -1) statuses.value[i] = updated
    }
  }

  const remove = async (id: string) => {
    await api.orderStatuses.remove(id)
    statuses.value = statuses.value.filter((s) => s.id !== id)
  }

  const reorder = async (reordered: OrderStatus[]) => {
    statuses.value = reordered
    await api.orderStatuses.reorder(reordered.map((s, i) => ({ id: s.id, position: i })))
  }

  return { statuses, loading, add, update, remove, reorder }
}
