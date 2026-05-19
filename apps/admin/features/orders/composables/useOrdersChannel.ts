import { ref, watch, type Ref } from 'vue'
import type { Order } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { useRealtimeWatch } from '~/shared/data/useRealtimeWatch'

type Handler<T> = (payload: T) => void
type VoidHandler = () => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<Order>>()
const updateHandlers = new Set<Handler<Order>>()
const deleteHandlers = new Set<Handler<{ id: string }>>()
const reconnectHandlers = new Set<VoidHandler>()

export const realtimeConnected = ref(false)

export const orderEvents = {
  onInsert(handler: Handler<Order>) {
    insertHandlers.add(handler)

    return () => insertHandlers.delete(handler)
  },
  onUpdate(handler: Handler<Order>) {
    updateHandlers.add(handler)

    return () => updateHandlers.delete(handler)
  },
  onDelete(handler: Handler<{ id: string }>) {
    deleteHandlers.add(handler)

    return () => deleteHandlers.delete(handler)
  },
  // PREPROD-110: триггерится при reconnect realtime-канала. Consumer'ы
  // используют чтобы пересинхронизировать список заказов с сервером —
  // INSERT/UPDATE/DELETE за период disconnect'а могли пропасть.
  onReconnect(handler: VoidHandler) {
    reconnectHandlers.add(handler)

    return () => reconnectHandlers.delete(handler)
  },
}

/**
 * Call ONCE in layout. Creates a single realtime channel for orders.
 */
export function useOrdersChannel(tenantId: Ref<string | null>) {
  const { orders } = useDatabase()

  const fetchAndBroadcast = async (
    row: Record<string, unknown>,
    handlers: Set<Handler<Order>>,
  ) => {
    const id = (row as { id: string }).id
    const order = await orders.getById(id)

    if (order) handlers.forEach((h) => h(order))
  }

  const { isConnected } = useRealtimeWatch('orders', tenantId, {
    column: 'tenant_id',
    onInsert: (row) => fetchAndBroadcast(row, insertHandlers),
    onUpdate: (row) => fetchAndBroadcast(row, updateHandlers),
    onDelete: (row) => deleteHandlers.forEach((h) => h({ id: (row as { id: string }).id })),
    onReconnect: () => reconnectHandlers.forEach((h) => h()),
  })

  watch(isConnected, (v) => {
    realtimeConnected.value = v
  }, { immediate: true })
}
