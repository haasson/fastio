import { computed } from 'vue'
import { useNuxtApp } from '#imports'
import type { OrderStatus, OrderStatusGroup } from '@fastio/shared'
import { orderStatusesApi, mapOrderStatus } from '~/utils/api/order-statuses'
import { useRealtimeList } from '~/composables/useRealtimeList'

export const useOrderStatuses = (tenantId: Ref<string>) => {
  const { $supabase } = useNuxtApp()

  const { items: statuses, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `order_statuses:${tenantId.value}` : null),
    table: 'order_statuses',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => orderStatusesApi.list($supabase, tenantId.value),
    mapper: mapOrderStatus,
  })

  const add = async (data: { name: string; groupType: OrderStatusGroup }) => {
    if (!tenantId.value) return
    const status = await orderStatusesApi.add($supabase, tenantId.value, data)

    if (status) statuses.value.push(status)
  }

  const update = async (id: string, data: { name: string; groupType: OrderStatusGroup }) => {
    const updated = await orderStatusesApi.update($supabase, id, data)

    if (updated) {
      const i = statuses.value.findIndex((s) => s.id === id)

      if (i !== -1) statuses.value[i] = updated
    }
  }

  const remove = async (id: string) => {
    await orderStatusesApi.remove($supabase, id)
    statuses.value = statuses.value.filter((s) => s.id !== id)
  }

  const reorder = async (reordered: OrderStatus[]) => {
    statuses.value = reordered
    await orderStatusesApi.reorder($supabase, reordered.map((s, i) => ({ id: s.id, position: i })))
  }

  return { statuses, loading, add, update, remove, reorder }
}
