<template>
  <div class="archive-root">
    <AppTableToolbar
      v-model:search="search"
      v-model:visible-columns="visibleColumns"
      search-placeholder="Поиск по гостю или телефону"
      :filter-count="activeFilterCount"
      :column-options="RESERVATION_COLUMN_OPTIONS"
      storage-key="reservations-archive:columns"
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

    <UiEmpty v-else-if="!rows.length" icon="calendar" text="Архив пуст" />

    <template v-else>
      <UiDataTable
        :columns="visibleColumnDefs"
        :data="rows"
        :filters="tableFilters"
        :row-key="(row: Reservation) => row.id"
        :bordered="false"
        :scroll-x="860"
        size="small"
        :row-props="(row: Reservation) => ({ onClick: () => openEdit(row), style: 'cursor: pointer' })"
        @update:filters="onFiltersUpdate"
      />
      <UiPagination
        v-model:page="page"
        :item-count="total"
        :page-size="PAGE_SIZE"
        class="pagination"
      />
    </template>

    <ReservationModal
      v-model="modalOpen"
      :reservation="selectedReservation"
      @saved="fetch"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiButton, UiDataTable, UiDatepicker, UiEmpty, UiPagination, UiSkeleton } from '@fastio/ui'
import type { Reservation, ReservationStatus } from '@fastio/shared'
import AppTableToolbar from '~/components/AppTableToolbar.vue'
import ReservationModal from '~/components/reservations/ReservationModal.vue'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useReservationTable, RESERVATION_COLUMN_OPTIONS } from '~/composables/ui/useReservationTable'
import {
  RESERVATION_ARCHIVE_STATUSES,
  RESERVATION_ARCHIVE_STATUS_OPTIONS,
} from '~/utils/reservation-constants'

const PAGE_SIZE = 20

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const api = useDatabase()

// Архив держит локальный state — данные пагинируются server-side и не нужны в глобальном сторе.
// ReservationsActive использует useReservationsStore (realtime) — разные паттерны намеренны.
const rows = ref<Reservation[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const filterDate = ref<string | null>(null)

const tableNames = computed(() => {
  const names = new Set(rows.value.map((r) => r.tableName).filter(Boolean) as string[])

  return [...names].sort()
})

const {
  search, visibleColumns, filterDateTs, guestMin, guestMax, tableFilters, activeFilterCount,
  clearFilters, visibleColumnDefs, onFiltersUpdate,
  modalOpen, selectedReservation, openCreate, openEdit,
} = useReservationTable(rows, tableNames, filterDate, RESERVATION_ARCHIVE_STATUS_OPTIONS)

const filterStatus = computed<ReservationStatus | null>(() => (tableFilters.value.status as ReservationStatus | null) ?? null,
)

const fetch = async () => {
  const tenantId = tenantStore.currentTenantId

  if (!tenantId) return

  loading.value = true
  try {
    const result = await api.reservations.listPaginated(tenantId, {
      statuses: filterStatus.value ? [filterStatus.value] : RESERVATION_ARCHIVE_STATUSES,
      branchId: branchStore.currentBranchId ?? undefined,
      date: filterDate.value ?? undefined,
      search: search.value.trim() || undefined,
      guestMin: guestMin.value ?? undefined,
      guestMax: guestMax.value ?? undefined,
      page: page.value,
      pageSize: PAGE_SIZE,
    })

    rows.value = result.data
    total.value = result.total
  } finally {
    loading.value = false
  }
}

const resetAndFetch = () => {
  page.value = 1
  fetch()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(resetAndFetch, 300)
})

watch([filterDate, filterStatus], resetAndFetch)

let guestTimer: ReturnType<typeof setTimeout> | null = null

watch([guestMin, guestMax], () => {
  if (guestTimer) clearTimeout(guestTimer)
  guestTimer = setTimeout(resetAndFetch, 300)
})
watch(page, fetch)
watch(() => branchStore.currentBranchId, resetAndFetch)

fetch()
</script>

<style scoped>
.archive-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
