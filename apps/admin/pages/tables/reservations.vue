<template>
  <!-- @click сбрасывает счётчик новых броней при любом взаимодействии со страницей -->
  <div class="reservations-root" @click="resetCount">
    <AppTableToolbar
      v-model:search="search"
      v-model:visible-columns="visibleColumns"
      search-placeholder="Поиск по гостю или телефону"
      :filter-count="activeFilterCount"
      :column-options="RESERVATION_COLUMN_OPTIONS"
      storage-key="tables-reservations:columns"
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

    <UiEmpty v-else-if="!rows.length" icon="calendar" text="Броней нет" />

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

    <ReservationDrawer
      v-model="modalOpen"
      :reservation="selectedReservation"
      @saved="fetch"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { UiButton, UiDataTable, UiDatepicker, UiEmpty, UiPagination, UiSkeleton } from '@fastio/ui'
import type { Reservation, ReservationStatus } from '@fastio/shared'
import { RESERVATION_STATUS_LABELS } from '@fastio/shared'
import AppTableToolbar from '~/shared/components/AppTableToolbar.vue'
import ReservationDrawer from '~/features/reservations/components/ReservationDrawer.vue'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { useReservationTable, RESERVATION_COLUMN_OPTIONS } from '~/features/reservations'
import { useNewReservationCounter, reservationEvents } from '~/features/reservations'

const PAGE_SIZE = 20

// Все статусы — единая таблица броней (активные + архив) с фильтром по статусу.
const ALL_STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']
const ALL_STATUS_OPTIONS = ALL_STATUSES.map((s) => ({ label: RESERVATION_STATUS_LABELS[s], value: s }))

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const api = useDatabase()
const { reset: resetCount } = useNewReservationCounter()

// Server-side пагинация: данные не нужны в глобальном сторе, тащим страницами.
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
} = useReservationTable(rows, tableNames, filterDate, ALL_STATUS_OPTIONS)

const filterStatus = computed<ReservationStatus | null>(() => (tableFilters.value.status as ReservationStatus | null) ?? null,
)

const fetch = async () => {
  const tenantId = tenantStore.currentTenantId

  if (!tenantId) return

  loading.value = true
  try {
    const result = await api.reservations.listPaginated(tenantId, {
      statuses: filterStatus.value ? [filterStatus.value] : ALL_STATUSES,
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

// Realtime: брони могут создаваться/меняться с витрины и других вкладок —
// при любом событии пересинхронизируем текущую страницу с сервером.
const unsubInsert = reservationEvents.onInsert(fetch)
const unsubUpdate = reservationEvents.onUpdate(fetch)
const unsubDelete = reservationEvents.onDelete(fetch)
const unsubReconnect = reservationEvents.onReconnect(fetch)

onUnmounted(() => {
  unsubInsert()
  unsubUpdate()
  unsubDelete()
  unsubReconnect()
})

// Сбрасываем счётчик при входе — считаем, что пользователь уже видит брони.
onMounted(resetCount)

fetch()
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.reservations-root {
  @include flex-col(var(--space-16));
}

.pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
