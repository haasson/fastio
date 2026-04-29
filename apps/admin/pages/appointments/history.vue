<template>
  <div class="history-root">
    <div class="toolbar">
      <UiInput
        v-model="search"
        placeholder="Поиск по клиенту или телефону"
        clearable
        size="medium"
        class="search"
      />
      <UiDatepicker
        v-model="dateFromTs"
        placeholder="Дата с"
        size="medium"
        class="date"
      />
      <UiDatepicker
        v-model="dateToTs"
        placeholder="Дата по"
        size="medium"
        class="date"
      />
      <UiButton
        v-if="hasFilters"
        type="text"
        size="small"
        @click="clearFilters"
      >Сбросить</UiButton>
    </div>

    <UiSkeleton v-if="loading && !appointments.length" :repeat="5" />

    <UiEmpty v-else-if="!appointments.length && !loading" icon="calendar" text="Записей нет" />

    <template v-else>
      <UiDataTable
        :columns="columns"
        :data="appointments"
        :row-key="(row: Appointment) => row.id"
        :bordered="false"
        :scroll-x="900"
        size="small"
        remote
        :loading="loading"
        :row-props="(row: Appointment) => ({ onClick: () => open(row), style: 'cursor: pointer' })"
        @update:filters="onFiltersUpdate"
        @update:sorter="onSorterUpdate"
      />

      <div v-if="total > pageSize" class="pagination">
        <UiButton
          type="text"
          :disabled="page <= 1"
          icon="chevronLeft"
          @click="page--"
        />
        <UiText size="small">{{ page }} / {{ totalPages }}</UiText>
        <UiButton
          type="text"
          :disabled="page >= totalPages"
          icon="chevronRight"
          @click="page++"
        />
      </div>
    </template>

    <AppointmentDrawer
      v-model="drawerOpen"
      :appointment="selected"
      :resources="resources"
      :services="services"
      @saved="fetch"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, h } from 'vue'
import { storeToRefs } from 'pinia'
import {
  UiInput, UiButton, UiText, UiBadge, UiSkeleton, UiEmpty,
  UiDataTable, UiDatepicker, useMessage,
} from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { Appointment, AppointmentStatus, Resource, Service } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useDatabase } from '~/composables/data/useDatabase'
import { appointmentEvents } from '~/composables/data/useAppointmentsChannel'
import AppointmentDrawer from '~/components/appointments/AppointmentDrawer.vue'
import { reportError } from '~/utils/reportError'

const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)
const api = useDatabase()
const message = useMessage()

// ─── Persisted filters per tenant ────────────────────────
// Сохраняем фильтры между сессиями — иначе админ при каждом возврате на
// вкладку «История» вынужден заново выставлять статус/услугу/диапазон дат.

type SavedFilters = {
  search: string
  dateFromTs: number | null
  dateToTs: number | null
  statusFilter: AppointmentStatus[]
  serviceFilter: string[]
  resourceFilter: string[]
  sortDir: 'asc' | 'desc'
}

const storageKey = computed(() => `appointments-history-filters-${currentTenantId.value ?? 'anon'}`)

const loadSavedFilters = (): Partial<SavedFilters> => {
  try {
    const raw = localStorage.getItem(storageKey.value)

    return raw ? JSON.parse(raw) as Partial<SavedFilters> : {}
  } catch {
    return {}
  }
}

const saved = loadSavedFilters()

const search = ref<string>(saved.search ?? '')
const dateFromTs = ref<number | null>(saved.dateFromTs ?? null)
const dateToTs = ref<number | null>(saved.dateToTs ?? null)
const statusFilter = ref<AppointmentStatus[]>(saved.statusFilter ?? [])
const serviceFilter = ref<string[]>(saved.serviceFilter ?? [])
const resourceFilter = ref<string[]>(saved.resourceFilter ?? [])
const sortDir = ref<'asc' | 'desc'>(saved.sortDir ?? 'desc')

// ─── Pagination & data ─
const page = ref(1)
const pageSize = 20
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / pageSize) || 1)

const appointments = ref<Appointment[]>([])
const resources = ref<Resource[]>([])
const services = ref<Service[]>([])
const loading = ref(false)

const tsToDateStr = (ts: number | null): string | undefined => {
  if (!ts) return undefined
  const d = new Date(ts)

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const hasFilters = computed(() => !!(
  search.value || dateFromTs.value || dateToTs.value
  || statusFilter.value.length || serviceFilter.value.length || resourceFilter.value.length
))

const clearFilters = () => {
  search.value = ''
  dateFromTs.value = null
  dateToTs.value = null
  statusFilter.value = []
  serviceFilter.value = []
  resourceFilter.value = []
}

const fetch = async () => {
  if (!currentTenantId.value) return
  loading.value = true
  try {
    const dateFrom = tsToDateStr(dateFromTs.value)
    const dateTo = tsToDateStr(dateToTs.value)
    const dateToExclusive = dateTo
      ? new Date(new Date(dateTo + 'T00:00:00').getTime() + 86_400_000).toISOString()
      : undefined
    const dateFromInclusive = dateFrom ? new Date(dateFrom + 'T00:00:00').toISOString() : undefined

    const [result, res, svc] = await Promise.all([
      api.appointments.listPaginated(currentTenantId.value, {
        statuses: statusFilter.value.length ? statusFilter.value : undefined,
        search: search.value || undefined,
        serviceId: serviceFilter.value[0] ?? undefined,
        resourceId: resourceFilter.value[0] ?? undefined,
        dateFrom: dateFromInclusive,
        dateTo: dateToExclusive,
        sortDir: sortDir.value,
        page: page.value,
        pageSize,
      }),
      api.resources.list(currentTenantId.value),
      api.services.listActive(currentTenantId.value),
    ])

    appointments.value = result.data
    total.value = result.total
    resources.value = res
    services.value = svc
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить историю')
  } finally {
    loading.value = false
  }
}

watch(
  [search, dateFromTs, dateToTs, statusFilter, serviceFilter, resourceFilter, sortDir, page, currentTenantId],
  (next, prev) => {
    // Сброс страницы при смене любого фильтра/сортировки (а не самой страницы).
    const filterChanged = next.slice(0, 7).some((v, i) => JSON.stringify(v) !== JSON.stringify(prev[i]))

    if (filterChanged) page.value = 1
    fetch()
  },
  { immediate: true },
)

// Персистим фильтры в localStorage при любом изменении.
watch(
  [search, dateFromTs, dateToTs, statusFilter, serviceFilter, resourceFilter, sortDir],
  ([s, df, dt, st, svc, res, dir]) => {
    try {
      const payload: SavedFilters = {
        search: s as string,
        dateFromTs: df as number | null,
        dateToTs: dt as number | null,
        statusFilter: st as AppointmentStatus[],
        serviceFilter: svc as string[],
        resourceFilter: res as string[],
        sortDir: dir as 'asc' | 'desc',
      }

      localStorage.setItem(storageKey.value, JSON.stringify(payload))
    } catch { /* ignore quota errors */ }
  },
)

// При смене тенанта подтягиваем сохранённые фильтры именно его.
watch(currentTenantId, () => {
  const fresh = loadSavedFilters()

  search.value = fresh.search ?? ''
  dateFromTs.value = fresh.dateFromTs ?? null
  dateToTs.value = fresh.dateToTs ?? null
  statusFilter.value = fresh.statusFilter ?? []
  serviceFilter.value = fresh.serviceFilter ?? []
  resourceFilter.value = fresh.resourceFilter ?? []
  sortDir.value = fresh.sortDir ?? 'desc'
})

// ─── Filters/sorter handlers from UiDataTable ─

type FilterPayload = Record<string, AppointmentStatus[] | string[] | null>

const onFiltersUpdate = (filters: FilterPayload) => {
  statusFilter.value = (filters.status as AppointmentStatus[] | null) ?? []
  serviceFilter.value = (filters.service as string[] | null) ?? []
  resourceFilter.value = (filters.resource as string[] | null) ?? []
}

type SorterPayload = { columnKey?: string; order?: 'ascend' | 'descend' | false } | null

const onSorterUpdate = (sorter: SorterPayload) => {
  if (!sorter || !sorter.order) {
    sortDir.value = 'desc'

    return
  }
  if (sorter.columnKey === 'startsAt') {
    sortDir.value = sorter.order === 'ascend' ? 'asc' : 'desc'
  }
}

// ─── Helpers ─

const formatDateTime = (iso: string) => {
  const d = new Date(iso)

  return new Intl.DateTimeFormat('ru', {
    timeZone: tenantStore.tenant.timezone,
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d)
}

const statusLabel: Record<AppointmentStatus, string> = {
  new: 'Новая', confirmed: 'Подтверждена', done: 'Завершена', cancelled: 'Отменена',
}

const statusType = (s: AppointmentStatus): 'default' | 'success' | 'warning' | 'error' => ({
  new: 'warning' as const,
  confirmed: 'success' as const,
  done: 'default' as const,
  cancelled: 'error' as const,
}[s])

const serviceName = (row: Appointment) => row.serviceName || (row.serviceId ? (services.value.find((s) => s.id === row.serviceId)?.name ?? '—') : '—')
const resourceName = (id: string | null) => id ? (resources.value.find((r) => r.id === id)?.name ?? '—') : '—'

// ─── Columns ─

const columns = computed<DataTableColumns<Appointment>>(() => [
  {
    title: 'Дата и время',
    key: 'startsAt',
    width: 180,
    sorter: true,
    sortOrder: sortDir.value === 'asc' ? 'ascend' : 'descend',
    render: (row) => h(UiText, { size: 'tiny' }, () => formatDateTime(row.startsAt)),
  },
  {
    title: 'Клиент',
    key: 'customer',
    width: 220,
    render: (row) => h('div', { class: 'cell-stack' }, [
      h(UiText, { size: 'tiny', weight: 'medium' }, () => row.customerName),
      h(UiText, { size: 'tiny', class: 'muted' }, () => row.customerPhone),
    ]),
  },
  {
    title: 'Услуга',
    key: 'service',
    filter: true,
    filterMultiple: false,
    filterOptionValues: serviceFilter.value,
    filterOptions: services.value.map((s) => ({ label: s.name, value: s.id })),
    render: (row) => h(UiText, { size: 'tiny' }, () => serviceName(row)),
  },
  {
    title: 'Исполнитель',
    key: 'resource',
    width: 180,
    filter: true,
    filterMultiple: false,
    filterOptionValues: resourceFilter.value,
    filterOptions: resources.value.map((r) => ({ label: r.name, value: r.id })),
    render: (row) => h(UiText, { size: 'tiny' }, () => resourceName(row.resourceId)),
  },
  {
    title: 'Статус',
    key: 'status',
    width: 160,
    filter: true,
    filterMultiple: true,
    filterOptionValues: statusFilter.value,
    filterOptions: (Object.keys(statusLabel) as AppointmentStatus[]).map((s) => ({ label: statusLabel[s], value: s })),
    render: (row) => h(UiBadge, { type: statusType(row.status) }, () => statusLabel[row.status]),
  },
])

const drawerOpen = ref(false)
const selected = ref<Appointment | null>(null)

const open = (appt: Appointment) => {
  selected.value = appt
  drawerOpen.value = true
}

const offInsert = appointmentEvents.onInsert(() => fetch())
const offUpdate = appointmentEvents.onUpdate(() => fetch())
const offDelete = appointmentEvents.onDelete(() => fetch())

onUnmounted(() => {
  offInsert()
  offUpdate()
  offDelete()
})
</script>

<style scoped lang="scss">
.history-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.toolbar {
  display: flex;
  gap: var(--space-12);
  flex-wrap: wrap;
  align-items: center;
}

.search {
  flex: 1;
  min-width: 220px;
}

.date {
  width: 180px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-12);
}

.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.muted {
  color: var(--color-text-secondary);
}
</style>
