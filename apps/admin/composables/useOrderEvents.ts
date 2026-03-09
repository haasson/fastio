import { computed, type Ref } from 'vue'
import { mapOrderEvent } from '~/utils/api/order-events'
import { useRealtimeList } from '~/composables/useRealtimeList'
import { useDatabase } from '~/composables/useDatabase'

export const useOrderEvents = (orderId: Ref<string>) => {
  const api = useDatabase()

  const { items: events, loading, refresh } = useRealtimeList({
    channelKey: computed(() => orderId.value ? `order_events:${orderId.value}` : null),
    table: 'order_events',
    filter: computed(() => `order_id=eq.${orderId.value}`),
    fetch: () => api.orderEvents.list(orderId.value),
    mapper: mapOrderEvent,
  })

  return { events, loading, refresh }
}
