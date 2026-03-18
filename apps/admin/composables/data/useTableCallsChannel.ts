import { type Ref } from 'vue'
import type { TableCall } from '@fastio/shared'
import { useRealtimeWatch } from '~/composables/data/useRealtimeWatch'
import type { TableCallRow } from '~/utils/api/db-types'

type Handler<T> = (payload: T) => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<TableCall>>()
const updateHandlers = new Set<Handler<TableCall>>()

const mapRow = (row: TableCallRow): TableCall => ({
  id: row.id,
  tenantId: row.tenant_id,
  tableId: row.table_id,
  callTypeId: row.call_type_id,
  callTypeName: row.call_type_name,
  createdAt: row.created_at,
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
  })
}
