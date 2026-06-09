<template>
  <div class="table-history-root">
    <div class="toolbar">
      <UiDatepicker
        v-model="filterDateTs"
        size="medium"
        :clearable="false"
        placeholder="Дата"
      />
      <UiSelect
        v-model:value="filterTableId"
        :options="tableOptions"
        size="medium"
        stateless
        placeholder="Все столы"
        style="min-width: 180px"
      />
      <UiInput
        v-model:value="search"
        placeholder="Имя или телефон гостя"
        size="medium"
        clearable
        style="width: 280px; max-width: 100%"
      />
      <UiInputNumber
        v-model:value="minTotal"
        size="medium"
        clearable
        :min="0"
        placeholder="Сумма от"
        style="width: 140px"
      />
    </div>

    <UiSkeleton v-if="loading" :repeat="5" />

    <UiEmpty v-else-if="!sessions.length" icon="clock" text="Чеков за выбранный день нет" />

    <template v-else>
      <UiDataTable
        :columns="columns"
        :data="sessions"
        :row-key="(row: OrderTableSession) => row.id"
        :bordered="false"
        :scroll-x="760"
        size="small"
        :row-props="(row: OrderTableSession) => ({ onClick: () => openSession(row), style: 'cursor: pointer' })"
      />
      <div v-if="total > PAGE_SIZE" class="pager">
        <UiPagination
          v-model:page="page"
          :item-count="total"
          :page-size="PAGE_SIZE"
          size="small"
        />
      </div>
    </template>

    <TableSessionDrawer v-model="drawerOpen" :session="selectedSession" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { UiDatepicker, UiSelect, UiInput, UiInputNumber, UiDataTable, UiPagination, UiEmpty, UiSkeleton, UiText } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import {
  formatDateTime, formatPrice, dateStrToTs, formatDateStr,
  todayInTz, addDaysToDateStr, localDateTimeToUtcIso,
} from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import { storeToRefs } from 'pinia'
import type { TableSession as OrderTableSession } from '~/features/orders'
import { useOrderStatusesStore } from '~/features/orders'
import { useTablesContext } from '~/features/tables'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import TableSessionDrawer from '~/features/tables/components/TableSessionDrawer.vue'

const PAGE_SIZE = 50

const api = useDatabase()
const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const ctx = useTablesContext()
const orderStatusesStore = useOrderStatusesStore()
const { statuses } = storeToRefs(orderStatusesStore)

// Резолв имени статуса заказа (id → name) через стор статусов.
const statusName = (statusId: string): string => statuses.value.find((s) => s.id === statusId)?.name ?? '—'

const sessions = ref<OrderTableSession[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)

// Фильтр по дате — один день, по умолчанию сегодня (в таймзоне тенанта).
const filterDate = ref<string>(todayInTz(tenantStore.timezone))
const filterDateTs = computed<number | null>({
  get: () => dateStrToTs(filterDate.value),
  // Пикер некларебельный — null прийти не должен, но на всякий случай держим сегодня.
  set: (val) => { filterDate.value = val ? formatDateStr(val) : todayInTz(tenantStore.timezone) },
})

const filterTableId = ref<string | null>(null)
const search = ref('')
const minTotal = ref<number | null>(null)

// Столы текущего филиала — из общего контекста страницы «Столы».
const tableOptions = computed(() => [
  { label: 'Все столы', value: null as string | null },
  ...ctx.tables.map((t) => ({ label: t.name, value: t.id })),
])

const loadSessions = async () => {
  const tenantId = tenantStore.currentTenantId

  if (!tenantId) return

  loading.value = true
  try {
    // Границы суток по таймзоне тенанта — иначе created_at (UTC) уедет на сутки.
    const tz = tenantStore.timezone
    const from = localDateTimeToUtcIso(filterDate.value, '00:00', tz)
    const to = localDateTimeToUtcIso(addDaysToDateStr(filterDate.value, 1), '00:00', tz)

    const result = await api.orders.listTableSessions(tenantId, {
      branchId: branchStore.currentBranchId,
      date: filterDate.value,
      from,
      to,
      tableId: filterTableId.value ?? undefined,
      search: search.value.trim() || undefined,
      minTotal: minTotal.value ?? undefined,
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE,
    })

    sessions.value = result.sessions
    total.value = result.total
  } catch (e) {
    reportError(e, { context: 'tables:history:loadSessions' })
    sessions.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const debouncedFetch = useDebounceFn(loadSessions, 300)

// Сброс на первую страницу при смене фильтра — иначе можно «зависнуть»
// на несуществующей странице после сужения выборки.
const resetAndFetch = () => {
  if (page.value !== 1) {
    page.value = 1

    return
  }
  loadSessions()
}

const resetAndDebounce = () => {
  if (page.value !== 1) {
    page.value = 1

    return
  }
  debouncedFetch()
}

watch([filterDate, filterTableId], resetAndFetch)
watch([search, minTotal], resetAndDebounce)
watch(page, loadSessions)
watch(() => branchStore.currentBranchId, resetAndFetch)

// ── Drill-in ──────────────────────────────────────────────────
const drawerOpen = ref(false)
const selectedSession = ref<OrderTableSession | null>(null)

const openSession = (row: OrderTableSession) => {
  selectedSession.value = row
  drawerOpen.value = true
}

// ── Колонки ───────────────────────────────────────────────────
const hintStyle = 'color: var(--color-text-hint)'

const columns: DataTableColumns<OrderTableSession> = [
  {
    title: 'Время',
    key: 'createdAt',
    width: 150,
    render: (row) => h(UiText, { size: 'tiny', style: 'white-space: nowrap' }, () => formatDateTime(row.createdAt)),
  },
  {
    title: 'Стол',
    key: 'tableName',
    width: 130,
    render: (row) => h(UiText, { size: 'small' }, () => row.tableName ?? '—'),
  },
  {
    title: 'Гость',
    key: 'customerName',
    render: (row) => h('div', { class: 'guest-cell' }, [
      h(UiText, { size: 'small', span: true }, () => row.customerName || '—'),
      row.customerPhone
        ? h(UiText, { size: 'tiny', span: true, style: hintStyle }, () => row.customerPhone!)
        : null,
    ]),
  },
  {
    title: 'Сумма',
    key: 'total',
    width: 170,
    render: (row) => h('div', { class: 'total-cell' }, [
      h(UiText, { size: 'small', span: true, style: 'font-weight: var(--font-weight-medium)' }, () => formatPrice(row.total)),
      row.discountAmount > 0
        ? h(UiText, { size: 'tiny', span: true, style: hintStyle }, () => `скидка ${formatPrice(row.discountAmount)}`)
        : null,
    ]),
  },
  {
    title: 'Статус',
    key: 'status',
    width: 140,
    render: (row) => h(UiText, { size: 'small', style: hintStyle }, () => statusName(row.status)),
  },
]

loadSessions()
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.table-history-root {
  @include flex-col(var(--space-16));
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.guest-cell,
.total-cell {
  display: flex;
  flex-direction: column;
}

.pager {
  display: flex;
  justify-content: flex-end;
}
</style>
