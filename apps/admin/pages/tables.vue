<template>
  <div>
    <TabsLayout :tabs="tabs" base-path="/tables" />

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
      @mark-served="onMarkServed"
      @cancel-kitchen="onCancelKitchen"
      @serve-kitchen="onServeKitchen"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, provide } from 'vue'
import { useMessage } from '@fastio/ui'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import TableCheckoutModal from '~/components/tables/TableCheckoutModal.vue'
import { usePageTitle } from '~/composables/usePageTitle'
import type { Table, TableCallType, TableCall, KitchenQueueItem } from '@fastio/shared'
import { todayInTz } from '@fastio/shared'
import { storeToRefs } from 'pinia'
import { useDatabase } from '~/composables/data/useDatabase'
import { useReservationsStore } from '~/stores/retail/reservations'
import { useTenantStore } from '~/stores/tenant'
import { useAuthStore } from '~/stores/auth'
import { useOrderStatusesStore } from '~/stores/retail/order-statuses'
import { orderEvents } from '~/composables/retail/useOrdersChannel'
import { tableCallEvents } from '~/composables/retail/useTableCallsChannel'
import { kitchenQueueEvents } from '~/composables/retail/useKitchenQueueChannel'
import { TablesContextKey, TodayReservationsKey } from '~/composables/retail/useTablesContext'
import type { TableSession, TableSessionItem } from '~/utils/api/retail/tables'

usePageTitle('Столы')

const tabs = [
  { value: 'list', label: 'Столы' },
  { value: 'layout', label: 'Схема' },
  { value: 'calls', label: 'Вызовы' },
]

// ── Stores ────────────────────────────────────────────────────
const api = useDatabase()
const tenantStore = useTenantStore()
const reservationsStore = useReservationsStore()
const authStore = useAuthStore()
const orderStatusesStore = useOrderStatusesStore()
const userId = computed(() => authStore.user?.id ?? null)
const { statuses } = storeToRefs(orderStatusesStore)
const { success, warning } = useMessage()

const tenantId = computed(() => tenantStore.currentTenantId)

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
    const [loadedTables, tags, types, calls] = await Promise.all([
      api.tables.list(id),
      api.tables.listTags(id),
      api.tableCallTypes.list(id),
      api.tableCalls.listActive(id),
    ])

    tables.value = loadedTables
    globalTags.value = tags
    callTypes.value = types
    activeCalls.value = calls
    tableSums.value = await api.tables.loadSums(loadedTables, cancelledStatusIds.value)
    await loadKitchenDishes(id, loadedTables)
  } finally {
    loading.value = false
  }
}

watch(tenantId, (id) => {
  if (id) load(id)
}, { immediate: true })

// ── Realtime ──────────────────────────────────────────────────
const reloadTableSums = (tableId: string) => {
  const table = tables.value.find((t) => t.id === tableId)

  if (!table?.isOpen) return
  api.tables.loadSums([table], cancelledStatusIds.value).then((partial) => {
    tableSums.value = {
      ...tableSums.value,
      [tableId]: partial[tableId] ?? { sum: 0, count: 0, items: [] },
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

onUnmounted(() => {
  unsubCallInsert()
  unsubCallUpdate()
  unsubKqInsert()
  unsubKqUpdate()
  unsubOrderInsert()
  unsubOrderUpdate()
})

// ── Actions ───────────────────────────────────────────────────
const toggleOpen = async (table: Table) => {
  const isClosing = table.isOpen
  const updated = await api.tables.setOpen(table.id, !table.isOpen)

  if (!updated) return

  const idx = tables.value.findIndex((t) => t.id === table.id)

  if (idx !== -1) tables.value[idx] = updated
  if (updated.isOpen) {
    tableSums.value[table.id] = { sum: 0, count: 0, items: [] }
  } else {
    delete tableSums.value[table.id]
    if (isClosing) {
      const seatedReservation = reservationsStore.reservations.find(
        (r) => r.status === 'seated' && r.tableId === table.id,
      )

      if (seatedReservation) await reservationsStore.complete(seatedReservation.id)
    }
  }
}

const checkout = (table: Table) => {
  checkoutTable.value = table
  checkoutModalOpen.value = true
}

const onCheckoutConfirmed = async (discountAmount: number) => {
  const table = checkoutTable.value

  if (!table) return

  checkoutLoading.value = true

  try {
    await toggleOpen(table)

    checkoutModalOpen.value = false

    // Скидка применяется после закрытия стола — если toggleOpen упадёт,
    // скидка не будет записана, и при повторе не задвоится
    if (discountAmount > 0 && table.openedAt) {
      await api.tables.applyDiscount(table.id, table.openedAt, discountAmount, cancelledStatusIds.value)
    }
  } finally {
    checkoutLoading.value = false
  }
}

const onMarkServed = async (dishId: string) => {
  for (const [tableId, items] of Object.entries(kitchenDishes.value)) {
    const idx = items.findIndex((i) => i.id === dishId)

    if (idx !== -1) {
      items.splice(idx, 1)
      if (!items.length) delete kitchenDishes.value[tableId]
      break
    }
  }
  await api.kitchenQueue.markServed(dishId, userId.value!)
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
  } catch {
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
  } catch {
    kitchenDishes.value[tableId] = prevKq
    warning('Не удалось подать блюдо')
  }
}

const onRemoveDish = async (table: Table, sessionItem: TableSessionItem) => {
  const item = await api.orders.findTableItem(table.id, sessionItem, cancelledStatusIds.value, table.openedAt ?? undefined)

  if (!item) {
    warning('Блюдо не найдено')

    return
  }

  await api.orders.removeItem(item.id, item.orderId)
  success(`${sessionItem.dishName} удалено`)
  reloadTableSums(table.id)
  reloadKitchenDishes()
}

const onConfirmItem = async (itemId: string, tableId: string) => {
  if (!userId.value) return
  await api.orders.confirmItem(itemId, userId.value)
  reloadTableSums(tableId)
  reloadKitchenDishes()
}

const onRejectItem = async (itemId: string, tableId: string) => {
  await api.orders.rejectItem(itemId)
  reloadTableSums(tableId)
}

const onConfirmAllItems = async (tableId: string) => {
  if (!userId.value) return
  await api.orders.confirmAllPendingItems(tableId, userId.value, cancelledStatusIds.value)
  reloadTableSums(tableId)
  reloadKitchenDishes()
}

const onCallResolved = async (id: string) => {
  await api.tableCalls.resolve(id)
  activeCalls.value = activeCalls.value.filter((c) => c.id !== id)
  success('Вызов закрыт')
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
  tables, tableSums, loading, globalTags, callTypes, activeCalls, kitchenDishes, tenantId,
  openTables, closedTables, callsByTable, readyDishes, totalReadyCount,
  toggleOpen, checkout, onMarkServed, onRemoveDish, onConfirmItem, onRejectItem,
  onConfirmAllItems, onCallResolved, onTableAdded, onTableUpdated, onTableDeleted,
  onPositionUpdated, onCallTypeAdded, onCallTypeRemoved, onGlobalTagsUpdated,
})
</script>

