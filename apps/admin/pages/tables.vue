<template>
  <div>
    <!-- Мультибранч + «Все филиалы»: самостоятельная read-only сводка вместо
         табов/списка (D-06). Никаких табов, готовых блюд, переходов. -->
    <TablesBranchSummary
      v-if="showSummary"
      :branches="branches"
      :table-count-by-branch="tableCountByBranch"
    />
    <TabsLayout v-else :tabs="tabs" base-path="/tables" />

    <TableCheckoutModal
      v-model="checkoutModalOpen"
      :table="checkoutTable"
      :session="checkoutTable ? tableSums[checkoutTable.id] : undefined"
      :kitchen-dishes="checkoutTable ? (kitchenDishes[checkoutTable.id] ?? []) : []"
      :ready-dishes="checkoutTable ? (readyDishes[checkoutTable.id] ?? []) : []"
      :loading="checkoutLoading"
      @confirm="onCheckoutConfirmed"
      @remove-dish="(item) => checkoutTable && onRemoveDish(checkoutTable, item)"
      @confirm-item="(itemId) => checkoutTable && onConfirmItem(itemId, checkoutTable.id)"
      @reject-item="(itemId) => checkoutTable && onRejectItem(itemId, checkoutTable.id)"
      @confirm-all="checkoutTable && onConfirmAllItems(checkoutTable.id)"
      @cancel-kitchen="onCancelKitchen"
      @serve-kitchen="onServeKitchen"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, provide } from 'vue'
import { useMessage } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'
import TablesBranchSummary from '~/features/tables/components/TablesBranchSummary.vue'
import TableCheckoutModal from '~/features/tables/components/TableCheckoutModal.vue'
import { usePageTitle } from '~/shared/composables/usePageTitle'
import type { Table, TableCallType, TableCall, TableSettings, KitchenQueueItem } from '@fastio/shared'
import { todayInTz } from '@fastio/shared'
import { storeToRefs } from 'pinia'
import { useDatabase } from '~/shared/data/useDatabase'
import { useReservationsStore, useNewReservationCounter } from '~/features/reservations'
import { useGate } from '~/shared/plan/useGate'
import { useTenantStore } from '~/shared/stores/tenant'
import { useAuthStore } from '~/shared/stores/auth'
import { useBranchStore } from '~/shared/stores/branch'
import { useOrderStatusesStore } from '~/features/orders'
import { orderEvents } from '~/features/orders'
import { tableCallEvents, tableEvents, seedTableBranches } from '~/features/tables'
import { kitchenQueueEvents } from '~/features/kitchen'
import { TablesContextKey, TodayReservationsKey } from '~/features/tables'
import type { TableSession, TableSessionItem } from '~/features/tables'
import { reportError } from '@fastio/shared/observability'

usePageTitle('Столы')

// ── Stores ────────────────────────────────────────────────────
const api = useDatabase()
const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const reservationsStore = useReservationsStore()
const gate = useGate()
const { count: newReservationCount } = useNewReservationCounter()
const authStore = useAuthStore()
const orderStatusesStore = useOrderStatusesStore()
const userId = computed(() => authStore.user?.id ?? null)
const { statuses } = storeToRefs(orderStatusesStore)
const { branches } = storeToRefs(branchStore)
const { success, warning } = useMessage()
const { confirm } = useConfirm()

const tenantId = computed(() => tenantStore.currentTenantId)

const tabs = computed(() => {
  const items: { value: string; label: string; count?: number }[] = [
    { value: 'list', label: 'Столы' },
    { value: 'layout', label: 'Схема' },
  ]

  // Брони — часть модуля «Столы». Таб виден при tables.view (бэкуется dineIn).
  if (gate.viewReservations.value.enabled) {
    items.push({ value: 'reservations', label: 'Бронирование', count: newReservationCount.value || undefined })
  }

  // История стола — dine-in чеки за день для разбора инцидентов. Право tables.history.
  if (gate.viewTableHistory.value.enabled) {
    items.push({ value: 'history', label: 'История' })
  }

  // Настройки (столы + брони) — под settings.edit, как все остальные настройки.
  if (gate.editSettings.value.enabled) items.push({ value: 'settings', label: 'Настройки' })

  return items
})

// D-04: один/ноль филиалов → не фильтруем; D-05: конкретный → фильтруем;
// D-06: null при мультибранче → саммари-режим (без фильтра)
const effectiveBranchId = computed<string | undefined>(() => {
  if (branchStore.branches.length <= 1) return undefined

  return branchStore.currentBranchId ?? undefined
})

// D-06/D-07: показываем саммари вместо плана зала
const showSummary = computed(() => branchStore.branches.length > 1 && branchStore.currentBranchId === null)

// D-08: счётчики столов по филиалам для саммари
const tableCountByBranch = computed(() => {
  const map: Record<string, { total: number; open: number }> = {}

  for (const t of tables.value) {
    if (!t.branchId) continue
    const entry = (map[t.branchId] ??= { total: 0, open: 0 })

    entry.total++
    if (t.isOpen) entry.open++
  }

  return map
})

const cancelledStatusIds = computed(() => statuses.value
  .filter((s) => s.groupType === 'cancelled')
  .map((s) => s.id),
)

// ── Checkout modal ────────────────────────────────────────────
const checkoutModalOpen = ref(false)
const checkoutTable = ref<Table | null>(null)
const checkoutLoading = ref(false)

// ── State ─────────────────────────────────────────────────────
const tables = ref<Table[]>([])
const tableSums = ref<Record<string, TableSession>>({})
const loading = ref(false)
const globalTags = ref<string[]>([])
const callTypes = ref<TableCallType[]>([])
const activeCalls = ref<TableCall[]>([])
const tableSettings = ref<TableSettings | null>(null)
const kitchenDishes = ref<Record<string, KitchenQueueItem[]>>({})

// ── Computed ──────────────────────────────────────────────────
const readyDishes = computed(() => {
  const map: Record<string, KitchenQueueItem[]> = {}

  for (const [tableId, items] of Object.entries(kitchenDishes.value)) {
    const ready = items.filter((i) => i.status === 'done' && !i.skipKitchen)

    if (ready.length) map[tableId] = ready
  }

  return map
})

const totalReadyCount = computed(() => Object.values(readyDishes.value).reduce((sum, items) => sum + items.length, 0))
const openTables = computed(() => tables.value
  .filter((t) => t.isOpen)
  .sort((a, b) => new Date(a.openedAt ?? 0).getTime() - new Date(b.openedAt ?? 0).getTime()),
)
const closedTables = computed(() => tables.value.filter((t) => !t.isOpen))
const callsByTable = computed(() => {
  const map: Record<string, TableCall[]> = {}

  for (const call of activeCalls.value) {
    ;(map[call.tableId] ??= []).push(call)
  }

  return map
})

// ── Load ──────────────────────────────────────────────────────
const buildKitchenDishesMap = (items: (KitchenQueueItem & { tableId: string })[]) => {
  const map: Record<string, KitchenQueueItem[]> = {}

  for (const item of items) {
    ;(map[item.tableId] ??= []).push(item)
  }

  return map
}

const loadKitchenDishes = async (tid: string, loadedTables: Table[]) => {
  const openTableIds = loadedTables.filter((t) => t.isOpen).map((t) => t.id)

  if (!openTableIds.length) {
    kitchenDishes.value = {}

    return
  }

  const items = await api.kitchenQueue.listActiveForTable(tid, openTableIds)

  kitchenDishes.value = buildKitchenDishesMap(items)
}

const reloadKitchenDishes = async () => {
  const tid = tenantId.value

  if (!tid) return

  const openTableIds = tables.value.filter((t) => t.isOpen).map((t) => t.id)

  if (!openTableIds.length) {
    kitchenDishes.value = {}

    return
  }

  const items = await api.kitchenQueue.listActiveForTable(tid, openTableIds)

  kitchenDishes.value = buildKitchenDishesMap(items)
}

const load = async (id: string) => {
  loading.value = true
  try {
    const [loadedTables, tags, types, calls, settings] = await Promise.all([
      api.tables.list(id, effectiveBranchId.value),
      api.tables.listTags(id),
      api.tableCallTypes.list(id),
      api.tableCalls.listActive(id),
      api.tableSettings.get(id),
    ])

    tables.value = loadedTables
    seedTableBranches(loadedTables)
    globalTags.value = tags
    callTypes.value = types
    activeCalls.value = calls
    tableSettings.value = settings
    tableSums.value = await api.tables.loadSums(loadedTables, cancelledStatusIds.value)
    await loadKitchenDishes(id, loadedTables)
  } finally {
    loading.value = false
  }
}

watch([tenantId, effectiveBranchId, () => branchStore.loading], ([id, , isLoading]) => {
  if (!id || isLoading) return
  void load(id)
}, { immediate: true })

// ── Realtime ──────────────────────────────────────────────────
const reloadTableSums = (tableId: string) => {
  const table = tables.value.find((t) => t.id === tableId)

  if (!table?.isOpen) return
  api.tables.loadSums([table], cancelledStatusIds.value).then((partial) => {
    tableSums.value = {
      ...tableSums.value,
      [tableId]: partial[tableId] ?? { sum: 0, items: [] },
    }
  })
}

const unsubCallInsert = tableCallEvents.onInsert((call) => {
  if (call.resolvedAt === null) activeCalls.value.push(call)
})

const unsubCallUpdate = tableCallEvents.onUpdate((call) => {
  const idx = activeCalls.value.findIndex((c) => c.id === call.id)

  if (call.resolvedAt) {
    if (idx !== -1) activeCalls.value.splice(idx, 1)
  } else {
    if (idx !== -1) activeCalls.value[idx] = call
    else activeCalls.value.push(call)
  }
})

const unsubKqInsert = kitchenQueueEvents.onInsert((item) => {
  if (item.deliveryType === 'dine_in' && item.status !== 'served') reloadKitchenDishes()
})

const unsubKqUpdate = kitchenQueueEvents.onUpdate((item) => {
  if (item.deliveryType === 'dine_in') {
    if (item.status === 'served') {
      for (const [tableId, items] of Object.entries(kitchenDishes.value)) {
        kitchenDishes.value[tableId] = items.filter((i) => i.id !== item.id)
        if (!kitchenDishes.value[tableId].length) delete kitchenDishes.value[tableId]
      }
    } else {
      reloadKitchenDishes()
    }
  }
})

const unsubOrderInsert = orderEvents.onInsert((order) => {
  if (order.tableId) reloadTableSums(order.tableId)
})

const unsubOrderUpdate = orderEvents.onUpdate((order) => {
  if (order.tableId) reloadTableSums(order.tableId)
})

// Realtime по самой таблице tables: create/activate/open/move с других вкладок.
// Неактивный (is_active=false, soft-delete/деактивация) → убираем; активный →
// заменяем или добавляем (мог быть только что создан/активирован).
const upsertTableFromRealtime = (table: Table) => {
  if (!table.isActive) {
    tables.value = tables.value.filter((t) => t.id !== table.id)

    return
  }

  // Не подмешиваем столы чужого филиала в отфильтрованный список (D-05/T-07-A3).
  // Незакреплённые столы (branchId=null) тоже исключаем при активном фильтре —
  // серверный load их не отдаёт (.eq('branch_id', X)), иначе realtime даёт дрейф.
  if (effectiveBranchId.value && table.branchId !== effectiveBranchId.value) return

  const idx = tables.value.findIndex((t) => t.id === table.id)

  if (idx !== -1) tables.value[idx] = table
  else tables.value.push(table)
}

const unsubTableInsert = tableEvents.onInsert(upsertTableFromRealtime)
const unsubTableUpdate = tableEvents.onUpdate(upsertTableFromRealtime)
const unsubTableDelete = tableEvents.onDelete((id) => {
  tables.value = tables.value.filter((t) => t.id !== id)
})

// PREPROD-110: после reconnect могли пропасть события (новые столы открыты,
// вызовы появились/сняты и т.д.). Реалтайм-сокет общий, так что достаточно
// подписаться на один bus — load() пересинхронизирует всё.
const unsubCallsReconnect = tableCallEvents.onReconnect(() => {
  if (tenantId.value) void load(tenantId.value)
})

onUnmounted(() => {
  unsubCallInsert()
  unsubCallUpdate()
  unsubKqInsert()
  unsubKqUpdate()
  unsubOrderInsert()
  unsubOrderUpdate()
  unsubTableInsert()
  unsubTableUpdate()
  unsubTableDelete()
  unsubCallsReconnect()
})

// ── Actions ───────────────────────────────────────────────────
const checkout = (table: Table) => {
  checkoutTable.value = table
  checkoutModalOpen.value = true
}

const toggleOpen = async (table: Table) => {
  if (table.isOpen) {
    // Открытый стол закрывается только через расчёт (checkout-модалка).
    checkout(table)

    return
  }

  try {
    await api.tables.openCheck(table.id)

    const idx = tables.value.findIndex((t) => t.id === table.id)

    if (idx !== -1) tables.value[idx] = { ...tables.value[idx], isOpen: true, openedAt: new Date().toISOString() }
    tableSums.value[table.id] = { sum: 0, items: [] }
  } catch (e) {
    reportError(e, { context: 'tables:toggleOpen:open', tableId: table.id })
    warning(e instanceof Error ? e.message : 'Не удалось открыть стол')
  }
}

const onCheckoutConfirmed = async (payload: { discountAmount: number; paymentType: 'cash' | 'card' }) => {
  const table = checkoutTable.value

  if (!table) return

  checkoutLoading.value = true
  try {
    const checkId = await api.tables.getOpenCheckId(table.id)

    if (!checkId) {
      warning('Открытый чек не найден')

      return
    }

    await api.tables.settleCheck(checkId, payload.discountAmount, payload.paymentType)

    checkoutModalOpen.value = false

    const idx = tables.value.findIndex((t) => t.id === table.id)

    if (idx !== -1) tables.value[idx] = { ...tables.value[idx], isOpen: false, openedAt: null }
    delete tableSums.value[table.id]
  } catch (e) {
    reportError(e, { context: 'tables:onCheckoutConfirmed', tableId: table.id })
    warning(e instanceof Error ? e.message : 'Не удалось рассчитать стол')
  } finally {
    checkoutLoading.value = false
  }
}

// Одна точка для «Забрал» (одно блюдо → row.ids) и «Забрал все» (readyIds всего
// стола). Batch-апдейт одним запросом (serveItems .in('id', ids)) + оптимистичное
// удаление готовых строк с откатом при ошибке.
const onMarkServedAll = async (ids: string[]) => {
  if (!ids.length || !userId.value) return

  const idSet = new Set(ids)
  const prev = kitchenDishes.value

  const next: Record<string, KitchenQueueItem[]> = {}

  for (const [tableId, items] of Object.entries(prev)) {
    const kept = items.filter((i) => !idSet.has(i.id))

    if (kept.length) next[tableId] = kept
  }
  kitchenDishes.value = next

  try {
    await api.kitchenQueue.serveItems(ids, userId.value)
    reloadKitchenDishes()
  } catch (e) {
    reportError(e, { context: 'tables:onMarkServedAll', dishIds: ids })
    kitchenDishes.value = prev
    warning('Не удалось отметить как поданное')
  }
}

const onCancelKitchen = async (ids: string[], charged: boolean) => {
  if (!checkoutTable.value) return
  const tableId = checkoutTable.value.id

  const prevKq = kitchenDishes.value[tableId] ?? []

  kitchenDishes.value[tableId] = prevKq.filter((i) => !ids.includes(i.id))
  if (!kitchenDishes.value[tableId]?.length) delete kitchenDishes.value[tableId]

  try {
    await api.kitchenQueue.cancelItems(ids, charged)
    reloadKitchenDishes()
  } catch (e) {
    reportError(e, { context: 'tables:onCancelKitchen', tableId, dishIds: ids, charged })
    kitchenDishes.value[tableId] = prevKq
    warning('Не удалось отменить блюдо')
  }
}

const onServeKitchen = async (ids: string[]) => {
  if (!checkoutTable.value || !userId.value) return
  const tableId = checkoutTable.value.id

  const prevKq = kitchenDishes.value[tableId] ?? []

  kitchenDishes.value[tableId] = prevKq.filter((i) => !ids.includes(i.id))
  if (!kitchenDishes.value[tableId]?.length) delete kitchenDishes.value[tableId]

  try {
    await api.kitchenQueue.serveItems(ids, userId.value)
    reloadKitchenDishes()
  } catch (e) {
    reportError(e, { context: 'tables:onServeKitchen', tableId, dishIds: ids })
    kitchenDishes.value[tableId] = prevKq
    warning('Не удалось подать блюдо')
  }
}

const onRemoveDish = async (table: Table, sessionItem: TableSessionItem) => {
  const item = await api.orders.findTableItem(table.id, sessionItem)

  if (!item) {
    warning('Блюдо не найдено')

    return
  }

  const ok = await confirm({
    title: `Удалить «${sessionItem.dishName}»?`,
    message: 'Позиция будет удалена со стола без возможности восстановления.',
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (!ok) return

  try {
    await api.orders.removeItem(item.id)
    success(`${sessionItem.dishName} удалено`)
    reloadTableSums(table.id)
    reloadKitchenDishes()
  } catch (e) {
    reportError(e, { context: 'tables:onRemoveDish', tableId: table.id, itemId: item.id })
    warning('Не удалось удалить блюдо')
  }
}

const onConfirmItem = async (itemId: string, tableId: string) => {
  if (!userId.value) return
  try {
    await api.orders.confirmItem(itemId, userId.value)
    reloadTableSums(tableId)
    reloadKitchenDishes()
  } catch (e) {
    reportError(e, { context: 'tables:onConfirmItem', itemId, tableId })
    warning('Не удалось подтвердить позицию')
  }
}

const onRejectItem = async (itemId: string, tableId: string) => {
  try {
    await api.orders.rejectItem(itemId)
    reloadTableSums(tableId)
  } catch (e) {
    reportError(e, { context: 'tables:onRejectItem', itemId, tableId })
    warning('Не удалось отклонить позицию')
  }
}

const onConfirmAllItems = async (tableId: string) => {
  if (!userId.value) return
  try {
    await api.orders.confirmAllPendingItems(tableId, userId.value)
    reloadTableSums(tableId)
    reloadKitchenDishes()
  } catch (e) {
    reportError(e, { context: 'tables:onConfirmAllItems', tableId })
    warning('Не удалось подтвердить позиции')
  }
}

const onCallResolved = async (id: string) => {
  try {
    await api.tableCalls.resolve(id)
    activeCalls.value = activeCalls.value.filter((c) => c.id !== id)
    success('Вызов закрыт')
  } catch (e) {
    reportError(e, { context: 'tables:onCallResolved', callId: id })
    warning('Не удалось закрыть вызов')
  }
}

const onTableAdded = (table: Table) => {
  tables.value.push(table)
}
const onTableUpdated = (table: Table) => {
  if (!table.isActive) {
    tables.value = tables.value.filter((t) => t.id !== table.id)

    return
  }

  const idx = tables.value.findIndex((t) => t.id === table.id)

  if (idx !== -1) tables.value[idx] = table
}
const onTableDeleted = (id: string) => {
  tables.value = tables.value.filter((t) => t.id !== id)
}
const onPositionUpdated = (id: string, x: number | null, y: number | null) => {
  const table = tables.value.find((t) => t.id === id)

  if (table) {
    table.positionX = x
    table.positionY = y
  }
}

const onCallTypeAdded = async (name: string) => {
  if (!tenantId.value) return
  const type = await api.tableCallTypes.add(tenantId.value, name)

  if (type) callTypes.value.push(type)
}

const onCallTypeRemoved = async (id: string) => {
  await api.tableCallTypes.remove(id)
  callTypes.value = callTypes.value.filter((t) => t.id !== id)
}

const onGlobalTagsUpdated = (tags: string[]) => {
  globalTags.value = tags
}

const onSettingsSaved = (settings: TableSettings) => {
  tableSettings.value = settings
}

// ── Today's reservations ─────────────────────────────────────
const todayReservations = computed(() => {
  const today = todayInTz(tenantStore.timezone)

  return reservationsStore.reservations.filter(
    (r) => r.reservedDate === today && (r.status === 'confirmed' || r.status === 'pending' || r.status === 'seated'),
  )
})

provide(TodayReservationsKey, todayReservations)

// ── Provide context ───────────────────────────────────────────
provide(TablesContextKey, {
  tables, tableSums, loading, globalTags, callTypes, activeCalls, tableSettings, kitchenDishes, tenantId,
  openTables, closedTables, callsByTable, readyDishes, totalReadyCount,
  branches,
  toggleOpen, checkout, onMarkServedAll, onRemoveDish, onConfirmItem, onRejectItem,
  onConfirmAllItems, onCallResolved, onTableAdded, onTableUpdated, onTableDeleted,
  onPositionUpdated, onCallTypeAdded, onCallTypeRemoved, onGlobalTagsUpdated, onSettingsSaved,
  reloadTableSums, reloadKitchenDishes,
})
</script>

