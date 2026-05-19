import { type Ref } from 'vue'
import type { KitchenQueueItem } from '@fastio/shared'
import { useRealtimeWatch } from '~/shared/data/useRealtimeWatch'
import { mapKitchenQueueItem } from '../api/kitchen-queue'

type Handler<T> = (payload: T) => void
type VoidHandler = () => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<KitchenQueueItem>>()
const updateHandlers = new Set<Handler<KitchenQueueItem>>()
const deleteHandlers = new Set<Handler<{ id: string }>>()
const reconnectHandlers = new Set<VoidHandler>()

export const kitchenQueueEvents = {
  onInsert(handler: Handler<KitchenQueueItem>) {
    insertHandlers.add(handler)

    return () => insertHandlers.delete(handler)
  },
  onUpdate(handler: Handler<KitchenQueueItem>) {
    updateHandlers.add(handler)

    return () => updateHandlers.delete(handler)
  },
  onDelete(handler: Handler<{ id: string }>) {
    deleteHandlers.add(handler)

    return () => deleteHandlers.delete(handler)
  },
  // PREPROD-110: триггерится при reconnect realtime-канала. Consumer'ы
  // используют чтобы пересинхронизировать очередь кухни с сервером.
  onReconnect(handler: VoidHandler) {
    reconnectHandlers.add(handler)

    return () => reconnectHandlers.delete(handler)
  },
}

/**
 * Call ONCE in layout. Creates a single realtime channel for kitchen_queue.
 */
export function useKitchenQueueChannel(tenantId: Ref<string | null>) {
  useRealtimeWatch('kitchen_queue', tenantId, {
    column: 'tenant_id',
    onInsert: (row) => {
      const item = mapKitchenQueueItem(row as unknown as Record<string, unknown>)

      insertHandlers.forEach((h) => h(item))
    },
    onUpdate: (row) => {
      const item = mapKitchenQueueItem(row as unknown as Record<string, unknown>)

      updateHandlers.forEach((h) => h(item))
    },
    onDelete: (row) => {
      deleteHandlers.forEach((h) => h({ id: (row as { id: string }).id }))
    },
    onReconnect: () => reconnectHandlers.forEach((h) => h()),
  })
}
