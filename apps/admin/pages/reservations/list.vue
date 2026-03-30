<template>
  <div class="list-root">
    <AppTableToolbar
      v-model:search="search"
      v-model:visible-columns="visibleColumns"
      search-placeholder="Поиск по гостю или телефону"
      :filter-count="activeFilterCount"
      :column-options="RESERVATION_COLUMN_OPTIONS"
      storage-key="reservations:columns"
      @reset="clearFilters"
    >
      <template #filters>
        <UiDatepicker v-model="filterDateTs" size="medium" placeholder="Фильтр по дате" />
      </template>
      <template #actions>
        <UiButton
          type="primary"
          size="medium"
          icon="plus"
          @click="openCreate"
        >Добавить</UiButton>
      </template>
    </AppTableToolbar>

    <UiSkeleton v-if="loading" :repeat="5" />

    <UiEmpty v-else-if="!reservations.length" icon="calendar" text="Броней нет" />

    <UiDataTable
      v-else
      :columns="visibleColumnDefs"
      :data="searchedData"
      :filters="tableFilters"
      :row-key="(row: Reservation) => row.id"
      :bordered="false"
      :scroll-x="860"
      size="small"
      :row-props="(row: Reservation) => ({ onClick: () => openEdit(row), style: 'cursor: pointer' })"
      @update:filters="onFiltersUpdate"
    />

    <ReservationModal
      v-model="modalOpen"
      :reservation="selectedReservation"
      @saved="reservationsStore.refresh()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiDataTable, UiDatepicker, UiEmpty, UiSkeleton } from '@fastio/ui'
import type { Reservation } from '@fastio/shared'
import AppTableToolbar from '~/components/AppTableToolbar.vue'
import ReservationModal from '~/components/reservations/ReservationModal.vue'
import { useReservationsStore } from '~/stores/reservations'
import { useReservationTable, RESERVATION_COLUMN_OPTIONS } from '~/composables/ui/useReservationTable'

// Активные брони живут в глобальном сторе — обновляются через realtime без перезапросов.
// ReservationsArchive держит локальный state — там пагинация server-side.
const reservationsStore = useReservationsStore()
const { reservations, filtered, loading, tableNames, filterDate } = storeToRefs(reservationsStore)

const {
  search, visibleColumns, filterDateTs, tableFilters, activeFilterCount,
  clearFilters, visibleColumnDefs, onFiltersUpdate,
  modalOpen, selectedReservation, openCreate, openEdit,
} = useReservationTable(reservations, tableNames, filterDate)

const searchedData = computed(() => {
  const q = search.value.trim().toLowerCase()

  if (!q) return filtered.value

  return filtered.value.filter((r) => r.guestName.toLowerCase().includes(q) || r.guestPhone.includes(q),
  )
})
</script>

<style scoped>
.list-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
