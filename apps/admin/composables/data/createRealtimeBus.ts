import { type Ref } from 'vue'
import { useRealtimeWatch } from '~/composables/data/useRealtimeWatch'

type Handler<T> = (payload: T) => void

export type RealtimeBus<T> = {
  onInsert(handler: Handler<T>): () => boolean
  onUpdate(handler: Handler<T>): () => boolean
  onDelete(handler: Handler<{ id: string }>): () => boolean
  attach(tenantId: Ref<string | null>): void
}

/**
 * Фабрика глобальной шины realtime-событий по таблице тенанта. Один экземпляр
 * на таблицу, hot-dispose чистит handlers (полезно для HMR в dev). `attach` —
 * подписка на канал Supabase, обычно вызывается из `useRealtimeChannels`.
 */
export function createRealtimeBus<T>(opts: {
  table: string
  mapper: (row: Record<string, unknown>) => T
  logTag?: string
}): RealtimeBus<T> {
  const insertHandlers = new Set<Handler<T>>()
  const updateHandlers = new Set<Handler<T>>()
  const deleteHandlers = new Set<Handler<{ id: string }>>()

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      insertHandlers.clear()
      updateHandlers.clear()
      deleteHandlers.clear()
    })
  }

  const broadcast = (row: Record<string, unknown>, handlers: Set<Handler<T>>) => {
    try {
      handlers.forEach((h) => h(opts.mapper(row)))
    } catch (e) {
      if (import.meta.dev) console.warn(`[${opts.logTag ?? opts.table}] malformed payload`, e)
    }
  }

  return {
    onInsert(handler) {
      insertHandlers.add(handler)

      return () => insertHandlers.delete(handler)
    },
    onUpdate(handler) {
      updateHandlers.add(handler)

      return () => updateHandlers.delete(handler)
    },
    onDelete(handler) {
      deleteHandlers.add(handler)

      return () => deleteHandlers.delete(handler)
    },
    attach(tenantId) {
      useRealtimeWatch(opts.table, tenantId, {
        column: 'tenant_id',
        onInsert: (row) => broadcast(row, insertHandlers),
        onUpdate: (row) => broadcast(row, updateHandlers),
        onDelete: (row) => deleteHandlers.forEach((h) => h({ id: (row as { id: string }).id })),
      })
    },
  }
}
