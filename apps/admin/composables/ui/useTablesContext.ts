import { inject, reactive } from 'vue'
import type { InjectionKey, Ref, ComputedRef } from 'vue'
import type { Table, TableCallType, TableCall, KitchenQueueItem } from '@fastio/shared'
import type { TableSession, TableSessionItem } from '~/utils/api/tables'

export type TablesContext = {
  // State
  tables: Ref<Table[]>
  tableSums: Ref<Record<string, TableSession>>
  loading: Ref<boolean>
  globalTags: Ref<string[]>
  callTypes: Ref<TableCallType[]>
  activeCalls: Ref<TableCall[]>
  kitchenDishes: Ref<Record<string, KitchenQueueItem[]>>
  tenantId: ComputedRef<string | null>

  // Computed
  openTables: ComputedRef<Table[]>
  closedTables: ComputedRef<Table[]>
  callsByTable: ComputedRef<Record<string, TableCall[]>>
  readyDishes: ComputedRef<Record<string, KitchenQueueItem[]>>
  totalReadyCount: ComputedRef<number>

  // Actions
  toggleOpen: (table: Table) => Promise<void>
  checkout: (table: Table) => Promise<void>
  onMarkServed: (dishId: string) => Promise<void>
  onRemoveDish: (table: Table, item: TableSessionItem) => Promise<void>
  onConfirmItem: (itemId: string, tableId: string) => Promise<void>
  onRejectItem: (itemId: string, tableId: string) => Promise<void>
  onConfirmAllItems: (tableId: string) => Promise<void>
  onCallResolved: (id: string) => Promise<void>
  onTableAdded: (table: Table) => void
  onTableUpdated: (table: Table) => void
  onTableDeleted: (id: string) => void
  onPositionUpdated: (id: string, x: number | null, y: number | null) => void
  onCallTypeAdded: (name: string) => Promise<void>
  onCallTypeRemoved: (id: string) => Promise<void>
  onGlobalTagsUpdated: (tags: string[]) => void
}

export const TablesContextKey: InjectionKey<TablesContext> = Symbol('tables:context')

export const useTablesContext = () => reactive(inject(TablesContextKey)!)
