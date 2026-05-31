import { type Ref } from 'vue'
import type { Table } from '@fastio/shared'
import { useRealtimeWatch } from '~/shared/data/useRealtimeWatch'
import type { TableRow } from '~/shared/data/db-types'
import { mapTable } from '../api/tables'

type Handler<T> = (payload: T) => void
type VoidHandler = () => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<Table>>()
const updateHandlers = new Set<Handler<Table>>()
const deleteHandlers = new Set<Handler<string>>()
const reconnectHandlers = new Set<VoidHandler>()

export const tableEvents = {
  onInsert(handler: Handler<Table>) {
    insertHandlers.add(handler)

    return () => insertHandlers.delete(handler)
  },
  onUpdate(handler: Handler<Table>) {
    updateHandlers.add(handler)

    return () => updateHandlers.delete(handler)
  },
  onDelete(handler: Handler<string>) {
    deleteHandlers.add(handler)

    return () => deleteHandlers.delete(handler)
  },
  // PREPROD-110: триггерится при reconnect realtime-канала.
  onReconnect(handler: VoidHandler) {
    reconnectHandlers.add(handler)

    return () => reconnectHandlers.delete(handler)
  },
}

/**
 * Call ONCE in useRealtimeChannels. Creates a single realtime channel for tables.
 * Без него create/activate/open/move стола не транслировались на другие вкладки.
 */
export function useTablesChannel(tenantId: Ref<string | null>) {
  useRealtimeWatch('tables', tenantId, {
    column: 'tenant_id',
    onInsert: (row) => {
      const table = mapTable(row as TableRow)

      insertHandlers.forEach((h) => h(table))
    },
    onUpdate: (row) => {
      const table = mapTable(row as TableRow)

      updateHandlers.forEach((h) => h(table))
    },
    // DELETE отдаёт только old (primary key) — нам нужен лишь id.
    onDelete: (row) => {
      const id = (row as { id: string }).id

      deleteHandlers.forEach((h) => h(id))
    },
    onReconnect: () => reconnectHandlers.forEach((h) => h()),
  })
}
