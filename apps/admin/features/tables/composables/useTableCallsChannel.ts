import { type Ref } from 'vue'
import type { TableCall } from '@fastio/shared'
import { useRealtimeWatch } from '~/shared/data/useRealtimeWatch'
import type { TableCallRow } from '~/shared/data/db-types'

type Handler<T> = (payload: T) => void
type VoidHandler = () => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<TableCall>>()
const updateHandlers = new Set<Handler<TableCall>>()
const reconnectHandlers = new Set<VoidHandler>()

const mapRow = (row: TableCallRow): TableCall => ({
  id: row.id,
  tenantId: row.tenant_id,
  tableId: row.table_id,
  callTypeId: row.call_type_id,
  callTypeName: row.call_type_name,
  createdAt: row.created_at ?? new Date().toISOString(),
  resolvedAt: row.resolved_at,
})

export const tableCallEvents = {
  onInsert(handler: Handler<TableCall>) {
    insertHandlers.add(handler)

    return () => insertHandlers.delete(handler)
  },
  onUpdate(handler: Handler<TableCall>) {
    updateHandlers.add(handler)

    return () => updateHandlers.delete(handler)
  },
  // PREPROD-110: триггерится при reconnect realtime-канала.
  onReconnect(handler: VoidHandler) {
    reconnectHandlers.add(handler)

    return () => reconnectHandlers.delete(handler)
  },
}

/**
 * Call ONCE in layout. Creates a single realtime channel for table_calls.
 */
export function useTableCallsChannel(tenantId: Ref<string | null>) {
  useRealtimeWatch('table_calls', tenantId, {
    column: 'tenant_id',
    onInsert: (row) => {
      const call = mapRow(row as TableCallRow)

      insertHandlers.forEach((h) => h(call))
    },
    onUpdate: (row) => {
      const call = mapRow(row as TableCallRow)

      updateHandlers.forEach((h) => h(call))
    },
    onReconnect: () => reconnectHandlers.forEach((h) => h()),
  })
}
