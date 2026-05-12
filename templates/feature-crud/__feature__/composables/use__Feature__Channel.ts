import { type Ref } from 'vue'
import { useRealtimeWatch } from '~/shared/data/useRealtimeWatch'
import type { __FEATURE_PASCAL__ } from '../api/__feature__'

type Handler<T> = (payload: T) => void

const insertHandlers = new Set<Handler<__FEATURE_PASCAL__>>()
const updateHandlers = new Set<Handler<__FEATURE_PASCAL__>>()
const deleteHandlers = new Set<Handler<{ id: string }>>()

export const __FEATURE_CAMEL__Events = {
  onInsert(h: Handler<__FEATURE_PASCAL__>) {
    insertHandlers.add(h)
    return () => insertHandlers.delete(h)
  },
  onUpdate(h: Handler<__FEATURE_PASCAL__>) {
    updateHandlers.add(h)
    return () => updateHandlers.delete(h)
  },
  onDelete(h: Handler<{ id: string }>) {
    deleteHandlers.add(h)
    return () => deleteHandlers.delete(h)
  },
}

/**
 * Call ONCE in layout. Creates a single realtime channel for __TABLE__.
 */
export function use__FEATURE_PASCAL__sChannel(tenantId: Ref<string | null>) {
  // TODO: map row → __FEATURE_PASCAL__ (вызови импортированный mapper)
  const toEntity = (row: Record<string, unknown>): __FEATURE_PASCAL__ => row as unknown as __FEATURE_PASCAL__

  useRealtimeWatch('__TABLE__', tenantId, {
    column: 'tenant_id',
    onInsert: (row) => insertHandlers.forEach((h) => h(toEntity(row))),
    onUpdate: (row) => updateHandlers.forEach((h) => h(toEntity(row))),
    onDelete: (row) => deleteHandlers.forEach((h) => h({ id: (row as { id: string }).id })),
  })
}
