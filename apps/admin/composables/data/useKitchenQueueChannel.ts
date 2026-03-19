import { type Ref } from 'vue'
import type { KitchenQueueItem } from '@fastio/shared'
import { useRealtimeWatch } from '~/composables/data/useRealtimeWatch'
import { mapKitchenQueueItem } from '~/utils/api/kitchen-queue'

type Handler<T> = (payload: T) => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<KitchenQueueItem>>()
const updateHandlers = new Set<Handler<KitchenQueueItem>>()
const deleteHandlers = new Set<Handler<{ id: string }>>()

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
  })
}
