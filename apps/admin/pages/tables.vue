<template>
  <div class="tables-root">
    <UiTabs v-model="activeTab" :tabs="TABS" prevent-compact />

    <!-- ── Столы ──────────────────────────────────────────── -->
    <template v-if="activeTab === 'tables'">
      <UiTag v-if="totalReadyCount > 0" type="success" round>
        {{ totalReadyCount }} {{ totalReadyCount === 1 ? 'блюдо готово' : 'блюд готово' }} к подаче
      </UiTag>

      <UiSkeleton v-if="loading" :repeat="6" />

      <template v-else-if="openTables.length || closedTables.length">
        <template v-if="openTables.length">
          <UiSectionHeader title="Открытые" />
          <div class="table-grid">
            <TableCard
              v-for="table in openTables"
              :key="table.id"
              :table="table"
              :session="tableSums[table.id]"
              :calls="callsByTable[table.id] ?? []"
              :kitchen-dishes="kitchenDishes[table.id] ?? []"
              :ready-dishes="readyDishes[table.id] ?? []"
              @add-dish="addDish(table)"
              @checkout="checkout(table)"
              @resolve-call="onCallResolved"
              @mark-served="onMarkServed"
              @remove-dish="(item) => onRemoveDish(table, item)"
              @confirm-item="(itemId) => onConfirmItem(itemId, table.id)"
              @reject-item="(itemId) => onRejectItem(itemId, table.id)"
              @confirm-all="onConfirmAllItems(table.id)"
            />
          </div>
        </template>

        <template v-if="closedTables.length">
          <UiSectionHeader title="Закрытые" />
          <div class="table-grid">
            <TableCard
              v-for="table in closedTables"
              :key="table.id"
              :table="table"
              :calls="[]"
              @toggle-open="toggleOpen(table)"
            />
          </div>
        </template>
      </template>

      <UiEmpty v-else icon="tableIcon" text="Столов пока нет. Создайте первый на вкладке «Схема»" />
    </template>

    <!-- ── Схема ──────────────────────────────────────────── -->
    <template v-else-if="activeTab === 'layout'">
      <TablesCanvas
        :tables="tables"
        :global-tags="globalTags"
        @add="onTableAdded"
        @update="onTableUpdated"
        @delete="onTableDeleted"
        @update-position="onPositionUpdated"
        @update:global-tags="globalTags = $event"
      />
    </template>

    <!-- ── Вызовы ─────────────────────────────────────────── -->
    <template v-else-if="activeTab === 'calls'">
      <TableCallSettings
        :call-types="callTypes"
        :active-calls="activeCalls"
        :tables="tables"
        @add-type="onCallTypeAdded"
        @remove-type="onCallTypeRemoved"
        @resolve="onCallResolved"
      />
    </template>

    <DishPickerModal
      v-if="tenantId"
      :model-value="dishPickerOpen"
      :tenant-id="tenantId"
      show-combos
      show-ingredients
      @select="onDishPicked"
      @update:model-value="dishPickerOpen = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { UiEmpty, UiSkeleton, UiSectionHeader, UiTabs, UiTag, useMessage } from '@fastio/ui'
import type { Table, TableCallType, TableCall, OrderItem, KitchenQueueItem } from '@fastio/shared'
import { pluralize } from '@fastio/shared'
import { useConfirm } from '@fastio/kit'
import { storeToRefs } from 'pinia'
import { useDatabase } from '~/composables/data/useDatabase'
import { useReservationsStore } from '~/stores/reservations'
import { useTenantStore } from '~/stores/tenant'
import { useAuthStore } from '~/stores/auth'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { orderEvents } from '~/composables/data/useOrdersChannel'
import { tableCallEvents } from '~/composables/data/useTableCallsChannel'
import { kitchenQueueEvents } from '~/composables/data/useKitchenQueueChannel'
import DishPickerModal, { type DishPickerResult } from '~/components/menu/DishPickerModal.vue'
import TablesCanvas from '~/components/tables/TablesCanvas.vue'
import TableCard from '~/components/tables/TableCard.vue'
import TableCallSettings from '~/components/tables/TableCallSettings.vue'
import type { TableSession, TableSessionItem } from '~/utils/api/tables'

const TABS = [
  { value: 'tables', label: 'Столы' },
  { value: 'layout', label: 'Схема' },
  { value: 'calls', label: 'Вызовы' },
]

const api = useDatabase()
const tenantStore = useTenantStore()
const reservationsStore = useReservationsStore()
const authStore = useAuthStore()
const orderStatusesStore = useOrderStatusesStore()
const userId = computed(() => authStore.user?.id ?? null)
const { statuses } = storeToRefs(orderStatusesStore)
const { success, warning } = useMessage()
const { confirm } = useConfirm()

const activeTab = ref<'tables' | 'layout' | 'calls'>('tables')
const tenantId = computed(() => tenantStore.currentTenantId)

const cancelledStatusIds = computed(() => statuses.value
  .filter((s) => s.groupType === 'cancelled')
  .map((s) => s.id),
)

// ── State ─────────────────────────────────────────────────
const tables = ref<Table[]>([])
const tableSums = ref<Record<string, TableSession>>({})
const loading = ref(false)
const globalTags = ref<string[]>([])
const callTypes = ref<TableCallType[]>([])
const activeCalls = ref<TableCall[]>([])
const kitchenDishes = ref<Record<string, KitchenQueueItem[]>>({})

const readyDishes = computed(() => {
  const map: Record<string, KitchenQueueItem[]> = {}

  for (const [tableId, items] of Object.entries(kitchenDishes.value)) {
    const ready = items.filter((i) => i.status === 'done')

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

// ── Realtime: table calls ──────────────────────────────────
const unsubCallInsert = tableCallEvents.onInsert((call) => {
  if (call.resolvedAt === null) {
    activeCalls.value.push(call)
  }
})

const unsubCallUpdate = tableCallEvents.onUpdate((call) => {
  const idx = activeCalls.value.findIndex((c) => c.id === call.id)

  if (call.resolvedAt) {
    // resolved — remove from active list
    if (idx !== -1) activeCalls.value.splice(idx, 1)
  } else {
    if (idx !== -1) activeCalls.value[idx] = call
    else activeCalls.value.push(call)
  }
})

// ── Kitchen dishes (queue) ───────────────────────────────────

const buildKitchenDishesMap = (items: (KitchenQueueItem & { tableId: string })[]) => {
  const map: Record<string, KitchenQueueItem[]> = {}

  for (const item of items) {
    ;(map[item.tableId] ??= []).push(item)
  }

  return map
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

const loadKitchenDishes = async (tid: string, loadedTables: Table[]) => {
  const openTableIds = loadedTables.filter((t) => t.isOpen).map((t) => t.id)

  if (!openTableIds.length) {
    kitchenDishes.value = {}

    return
  }

  const items = await api.kitchenQueue.listActiveForTable(tid, openTableIds)

  kitchenDishes.value = buildKitchenDishesMap(items)
}

const onMarkServed = async (dishId: string) => {
  // Optimistic removal
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

// ── Realtime: kitchen queue ──────────────────────────────────
const unsubKqInsert = kitchenQueueEvents.onInsert((item) => {
  if (item.deliveryType === 'dine_in' && item.status !== 'served') {
    reloadKitchenDishes()
  }
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

// ── Remove dish from check ───────────────────────────────────
const onRemoveDish = async (table: Table, sessionItem: TableSessionItem) => {
  const ok = await confirm({
    title: 'Удалить блюдо?',
    message: `«${sessionItem.dishName}» будет удалено из чека`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (ok !== true) return

  const item = await api.orders.findTableItem(table.id, sessionItem, cancelledStatusIds.value)

  if (!item) {
    warning('Блюдо не найдено')

    return
  }

  await api.orders.removeItem(item.id, item.orderId)
  reloadTableSums(table.id)
  reloadKitchenDishes()
}

// ── Realtime: orders (update sums on any change) ───────────
const reloadTableSums = (tableId: string) => {
  const table = tables.value.find((t) => t.id === tableId)

  if (!table?.isOpen) return
  api.tables.loadSums([table], cancelledStatusIds.value).then((partial) => {
    tableSums.value = { ...tableSums.value, ...partial }
  })
}

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

// ── Open / Close ──────────────────────────────────────────
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

const checkout = async (table: Table) => {
  const sum = tableSums.value[table.id]?.sum
  const allKitchenItems = kitchenDishes.value[table.id] ?? []
  const activeKitchen = allKitchenItems.filter((i) => i.status === 'queued' || i.status === 'in_progress')
  const doneKitchen = allKitchenItems.filter((i) => i.status === 'done')
  const count = activeKitchen.length

  if (count) {
    // Active kitchen items — three outcomes: cancel cooking, mark served, or abort (X)
    // Include done items' order IDs too so they get cleaned up either way
    const orderIds = [...new Set(allKitchenItems.map((i) => i.orderId))]

    const result = await confirm({
      title: `На кухне ещё ${count} ${pluralize(count, 'блюдо', 'блюда', 'блюд')}`,
      message: `Стол будет закрыт${sum ? ` · ${sum} ₽` : ''}. Что делать с блюдами?`,
      confirmText: 'Отменить готовку',
      confirmType: 'error',
      cancelText: 'Всё подано',
      cancelType: 'success',
      reverseActions: true,
    })

    if (result === null) return

    if (result) {
      await api.kitchenQueue.cancelForOrders(orderIds)
      // cancelForOrders only touches queued/in_progress — done items still need to be served
      if (doneKitchen.length) {
        const doneOrderIds = [...new Set(doneKitchen.map((i) => i.orderId))]

        await api.kitchenQueue.serveAllForOrders(doneOrderIds, userId.value!)
      }
    } else {
      await api.kitchenQueue.serveAllForOrders(orderIds, userId.value!)
    }
  } else {
    const ok = await confirm({
      title: `Расчёт: ${table.name}`,
      message: `Стол будет закрыт${sum ? ` · ${sum} ₽` : ''}. Все заказы останутся в истории.`,
      confirmText: 'Закрыть стол',
      confirmType: 'warning',
    })

    if (!ok) return

    // Mark any lingering done items as served so they don't haunt the next session
    if (doneKitchen.length) {
      const doneOrderIds = [...new Set(doneKitchen.map((i) => i.orderId))]

      await api.kitchenQueue.serveAllForOrders(doneOrderIds, userId.value!)
    }
  }

  await toggleOpen(table)
}

// ── Add dish ──────────────────────────────────────────────
const dishPickerOpen = ref(false)
const dishPickerTable = ref<Table | null>(null)

const addDish = (table: Table) => {
  dishPickerTable.value = table
  dishPickerOpen.value = true
}

const onDishPicked = async (result: DishPickerResult) => {
  const table = dishPickerTable.value

  if (!table || !tenantId.value) return

  const newStatusId = statuses.value.find((s) => s.groupType === 'new')?.id

  if (!newStatusId) {
    warning('Статусы заказов не загружены, попробуйте ещё раз')

    return
  }

  dishPickerOpen.value = false

  const modifiersDelta = (result.modifiers ?? []).reduce((sum, m) => sum + (m.priceDelta ?? 0), 0)
  const addonsDelta = (result.addons ?? []).reduce((sum, a) => sum + (a.price ?? 0), 0)
  const totalPrice = result.price + modifiersDelta + addonsDelta

  const item: OrderItem = {
    dishId: result.dishId,
    comboId: result.comboId ?? null,
    dishName: result.dishName,
    categoryName: result.categoryName,
    price: totalPrice,
    quantity: 1,
    removedIngredients: result.removedIngredients,
    modifiers: result.modifiers,
    addons: result.addons,
    completedAt: null,
    comboItems: null,
    addedBy: userId.value,
    confirmedBy: userId.value,
    status: 'confirmed' as const,
  }

  await api.orders.create({
    tenantId: tenantId.value,
    branchId: null,
    customerName: null,
    customerPhone: '',
    items: [item],
    deliveryType: 'dine_in',
    address: null,
    comment: null,
    promoCode: null,
    discountAmount: 0,
    subtotal: totalPrice,
    deliveryFee: 0,
    total: totalPrice,
    status: newStatusId,
    paymentType: 'cash',
    tableId: table.id,
    tableName: table.name,
  })
}

// ── Confirm / Reject pending items ────────────────────────
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

// ── Canvas mutations ──────────────────────────────────────
const onTableAdded = (table: Table) => {
  tables.value.push(table)
}

const onTableUpdated = (table: Table) => {
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

// ── Call type mutations ────────────────────────────────────
const onCallTypeAdded = async (name: string) => {
  if (!tenantId.value) return
  const type = await api.tableCallTypes.add(tenantId.value, name)

  if (type) callTypes.value.push(type)
}

const onCallTypeRemoved = async (id: string) => {
  await api.tableCallTypes.remove(id)
  callTypes.value = callTypes.value.filter((t) => t.id !== id)
}

const onCallResolved = async (id: string) => {
  await api.tableCalls.resolve(id)
  activeCalls.value = activeCalls.value.filter((c) => c.id !== id)
  success('Вызов закрыт')
}
</script>

<style scoped lang="scss">
.tables-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.table-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 340px));
  gap: 12px;
}
</style>
