<template>
  <div>
    <TablesCanvas
      :tables="ctx.tables"
      :today-reservations="todayReservations"
      :calls-by-table="ctx.callsByTable"
      :ready-dishes="ctx.readyDishes"
      :pending-by-table="pendingByTable"
      :escalation-minutes="escalationMinutes"
      @update="ctx.onTableUpdated"
      @update-position="ctx.onPositionUpdated"
      @open-detail="openDetail"
      @open-table="ctx.toggleOpen"
      @book-table="bookTable"
      @open-reservation="openReservation"
      @resolve-call="ctx.onCallResolved"
    />

    <TableDetailDrawer
      v-model="detailDrawerOpen"
      :table="detailDrawerTable"
      :session="detailDrawerTable ? ctx.tableSums[detailDrawerTable.id] : undefined"
      :calls="detailDrawerTable ? (ctx.callsByTable[detailDrawerTable.id] ?? []) : []"
      :kitchen-dishes="detailDrawerTable ? (ctx.kitchenDishes[detailDrawerTable.id] ?? []) : []"
      :ready-dishes="detailDrawerTable ? (ctx.readyDishes[detailDrawerTable.id] ?? []) : []"
      :show-category="showCategory"
      @add-dish="addDishFromDrawer"
      @checkout="checkoutFromDrawer"
      @resolve-call="ctx.onCallResolved"
      @mark-served="ctx.onMarkServed"
      @remove-dish="(item) => detailDrawerTable && ctx.onRemoveDish(detailDrawerTable, item)"
      @repeat-item="(item) => detailDrawerTable && repeatItem(item, detailDrawerTable)"
      @confirm-item="(itemId) => detailDrawerTable && ctx.onConfirmItem(itemId, detailDrawerTable.id)"
      @reject-item="(itemId) => detailDrawerTable && ctx.onRejectItem(itemId, detailDrawerTable.id)"
      @confirm-all="detailDrawerTable && ctx.onConfirmAllItems(detailDrawerTable.id)"
    />

    <ReservationDrawer
      v-model="reservationModalOpen"
      :reservation="reservationModalReservation"
      :preselected-table-id="reservationPreselectedTableId"
      @saved="onReservationSaved"
    />

    <DishPickerModal
      v-if="ctx.tenantId"
      :model-value="dishPickerOpen"
      :tenant-id="ctx.tenantId"
      show-combos
      :show-ingredients="gate.ingredients.value.enabled"
      @select="onDishPicked"
      @update:model-value="dishPickerOpen = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import type { Table, Reservation } from '@fastio/shared'
import { DEFAULT_TABLE_SETTINGS } from '@fastio/shared'
import { useTablesContext, TodayReservationsKey, useAddDishToTable } from '~/features/tables'
import { useReservationsStore } from '~/features/reservations'
import { useGate } from '~/shared/plan/useGate'
import TablesCanvas from '~/features/tables/components/TablesCanvas.vue'
import TableDetailDrawer from '~/features/tables/components/TableDetailDrawer.vue'
import ReservationDrawer from '~/features/reservations/components/ReservationDrawer.vue'
import DishPickerModal from '~/features/menu/components/DishPickerModal.vue'

const ctx = useTablesContext()
const todayReservations = inject(TodayReservationsKey, computed(() => []))

const escalationMinutes = computed(() => ctx.tableSettings?.callEscalationMinutes ?? DEFAULT_TABLE_SETTINGS.callEscalationMinutes)
const showCategory = computed(() => ctx.tableSettings?.showDishCategory ?? DEFAULT_TABLE_SETTINGS.showDishCategory)

// Кол-во новых позиций (status === 'pending') на стол — та же логика, что в TableCard
// («N ожидают»), чтобы список и схема показывали одинаковое число.
const pendingByTable = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}

  for (const [tableId, session] of Object.entries(ctx.tableSums)) {
    const count = (session?.items ?? []).filter((i) => i.status === 'pending').length

    if (count > 0) map[tableId] = count
  }

  return map
})

const reservationsStore = useReservationsStore()

const { dishPickerOpen, openPicker, onDishPicked, repeatItem } = useAddDishToTable(() => ctx.tenantId)
const gate = useGate()

// ── Detail drawer ───────────────────────────────────────
const detailDrawerOpen = ref(false)
const detailDrawerTable = ref<Table | null>(null)

// ── Reservation modal ───────────────────────────────────
const reservationModalOpen = ref(false)
const reservationModalReservation = ref<Reservation | null>(null)
const reservationPreselectedTableId = ref<string | null>(null)

// ── Canvas handlers ─────────────────────────────────────
const openDetail = (table: Table) => {
  detailDrawerTable.value = table
  detailDrawerOpen.value = true
}

const bookTable = (table: Table) => {
  reservationModalReservation.value = null
  reservationPreselectedTableId.value = table.id
  reservationModalOpen.value = true
}

const openReservation = (id: string) => {
  const reservation = todayReservations.value.find((r) => r.id === id)

  if (!reservation) return

  reservationModalReservation.value = reservation
  reservationPreselectedTableId.value = null
  reservationModalOpen.value = true
}

const onReservationSaved = () => {
  reservationsStore.refresh()
}

// ── Detail drawer handlers ──────────────────────────────
const addDishFromDrawer = () => {
  if (detailDrawerTable.value) openPicker(detailDrawerTable.value)
}

const checkoutFromDrawer = () => {
  if (detailDrawerTable.value) {
    ctx.checkout(detailDrawerTable.value)
  }
}
</script>
