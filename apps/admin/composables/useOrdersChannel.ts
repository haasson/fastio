import { type Ref } from 'vue'
import type { Order } from '@fastio/shared'
import { mapOrder } from '~/utils/api/orders'
import { useRealtimeWatch } from '~/composables/useRealtimeWatch'

type Handler<T> = (payload: T) => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<Order>>()
const updateHandlers = new Set<Handler<Order>>()
const deleteHandlers = new Set<Handler<{ id: string }>>()

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
}

/**
 * Call ONCE in layout. Creates a single realtime channel for orders.
 */
export function useOrdersChannel(tenantId: Ref<string | null>) {
  useRealtimeWatch('orders', tenantId, {
    column: 'tenant_id',
    onInsert: (row) => insertHandlers.forEach((h) => h(mapOrder(row))),
    onUpdate: (row) => updateHandlers.forEach((h) => h(mapOrder(row))),
    onDelete: (row) => deleteHandlers.forEach((h) => h({ id: (row as { id: string }).id })),
  })
}
