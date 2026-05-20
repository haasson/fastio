import { type Ref } from 'vue'
import { useRealtimeWatch } from '~/shared/data/useRealtimeWatch'

type Handler<T> = (payload: T) => void
type VoidHandler = () => void

export type RealtimeBus<T> = {
  onInsert(handler: Handler<T>): () => boolean
  onUpdate(handler: Handler<T>): () => boolean
  onDelete(handler: Handler<{ id: string }>): () => boolean
  /**
   * PREPROD-110: fires когда канал восстановился после disconnect.
   * Consumer'ы используют для рефетча данных, которые могли разойтись
   * с сервером за период отсутствия (пропущенные INSERT/UPDATE/DELETE).
   */
  onReconnect(handler: VoidHandler): () => boolean
  /**
   * PREPROD-260: при наличии `branchId` шина переподписывается на канал
   * `branch_id=eq.X` при смене филиала — меньше трафика при `null`
   * (=== "все филиалы") берётся tenant-level канал как раньше.
   */
  attach(tenantId: Ref<string | null>, branchId?: Ref<string | null>): void
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
  const reconnectHandlers = new Set<VoidHandler>()

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      insertHandlers.clear()
      updateHandlers.clear()
      deleteHandlers.clear()
      reconnectHandlers.clear()
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
    onReconnect(handler) {
      reconnectHandlers.add(handler)

      return () => reconnectHandlers.delete(handler)
    },
    attach(tenantId, branchId) {
      useRealtimeWatch(opts.table, tenantId, {
        column: 'tenant_id',
        onInsert: (row) => broadcast(row, insertHandlers),
        onUpdate: (row) => broadcast(row, updateHandlers),
        onDelete: (row) => deleteHandlers.forEach((h) => h({ id: (row as { id: string }).id })),
        onReconnect: () => reconnectHandlers.forEach((h) => h()),
        ...(branchId && { secondary: { column: 'branch_id', value: branchId } }),
      })
    },
  }
}
