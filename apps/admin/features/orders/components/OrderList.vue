<template>
  <div class="order-list-root">
    <UiSectionHeader title="Заказы">
      <template #left>
        <UiSegmentedControl
          v-model="orderView"
          :items="[{ label: 'Карточки', value: 'cards' }, { label: 'Таблица', value: 'list' }]"
          size="medium"
          data-tour="order-view"
        />
      </template>
      <template #right>
        <UiButton
          type="primary"
          size="medium"
          icon="plus"
          data-tour="add-order"
          @click="openCreateModal()"
        >Новый заказ</UiButton>
      </template>
    </UiSectionHeader>

    <AppTableToolbar
      v-model:search="searchInput"
      v-model:visible-columns="visibleColumns"
      search-placeholder="Имя или телефон…"
      :filter-count="activeFilterCount"
      :column-options="orderView === 'list' ? COLUMN_OPTIONS : undefined"
      storage-key="orders:list-columns"
      @reset="clearFilters"
    />

    <div v-if="pendingUpdate" class="pending-banner" @click="refresh">
      Появились новые заказы — нажмите, чтобы обновить
    </div>

    <div v-if="checkedRowKeys.length > 0" class="selection-bar">
      <span class="selection-count">Выбрано {{ checkedRowKeys.length }}</span>
      <UiSelect
        v-model:value="bulkStatusId"
        :options="statusOptions"
        placeholder="Сменить статус…"
        size="small"
        class="bulk-status-select"
      />
      <UiButton
        size="small"
        type="primary"
        :disabled="!bulkStatusId"
        :loading="bulkUpdating"
        @click="applyBulkStatus"
      >Применить</UiButton>
      <UiButton size="small" ghost @click="exportCsv">Экспорт CSV</UiButton>
      <UiButton size="small" ghost @click="checkedRowKeys = []">Снять выделение</UiButton>
    </div>

    <UiSkeleton v-if="loading" :height="44" :repeat="10" />

    <UiEmpty
      v-else-if="orders.length === 0"
      icon="orders"
      :text="hasAnyFilter ? 'Ничего не найдено' : 'Заказов пока нет'"
    />

    <template v-else>
      <!-- Карточки -->
      <div v-if="orderView === 'cards'" class="grid">
        <OrderCard
          v-for="order in orders"
          :key="order.id"
          :order="order"
          :updating="updatingIds.has(order.id)"
          :branch-name="branchId === null && branchStore.branches.length > 1 ? getBranchName(order.branchId) : undefined"
          @status-change="handleStatusChange"
          @open-edit="openEditModal"
        />
      </div>

      <!-- Таблица -->
      <UiDataTable
        v-else
        :columns="columns"
        :data="tableData"
        :row-key="(row: Order) => row.id"
        :checked-row-keys="checkedRowKeys"
        :row-props="getRowProps"
        :bordered="false"
        size="small"
        @update:sorter="handleSorterChange"
        @update:filters="handleFiltersChange"
        @update:checked-row-keys="checkedRowKeys = $event as string[]"
      />
    </template>

    <UiPagination
      v-if="total > pageSize"
      v-model:page="page"
      :item-count="total"
      :page-size="pageSize"
      :page-sizes="[10, 25, 50, 100]"
      show-size-picker
      size="medium"
      @update:page-size="pageSize = $event"
    />

    <OrderDrawer
      v-model="modalOpen"
      :order="modalOrder"
      :tenant-id="tenantId"
      :branch-id="branchId"
      @saved="handleOrderSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs, reactive, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { UiButton, UiDataTable, UiEmpty, UiPagination, UiSectionHeader, UiSegmentedControl, UiSelect, UiSkeleton } from '@fastio/ui'
import AppTableToolbar from '~/components/AppTableToolbar.vue'
import type { Order } from '@fastio/shared'
import { formatPhone, getAllowedStatuses, getKitchenAutoStatuses } from '@fastio/shared'
import OrderCard from '~/components/orders/OrderCard.vue'
import OrderDrawer from '~/components/orders/OrderDrawer.vue'
import { useOrders } from '~/composables/retail/useOrders'
import { DEFAULT_PAGE_SIZE } from '~/utils/api/retail/orders'
import { storeToRefs } from 'pinia'
import { useBranchStore } from '~/stores/branch'
import { useOrderStatusesStore } from '~/stores/retail/order-statuses'
import { useTenantStore } from '~/stores/tenant'
import useDrawer from '~/composables/ui/useDrawer'
import { useOrderTable, COLUMN_OPTIONS } from '~/composables/retail/useOrderTable'
import { DELIVERY_TYPE_LABELS, PAYMENT_TYPE_LABELS } from '~/config/retail/order-options'

const props = defineProps<{
  tenantId: string
  statusId: string | null
  branchId: string | null
}>()

const emit = defineEmits<{
  ordersChanged: []
}>()

const { tenantId: tenantIdRef, statusId: statusIdRef, branchId: branchIdRef } = toRefs(props)

const branchStore = useBranchStore()
const tenantStore = useTenantStore()
const { statuses } = storeToRefs(useOrderStatusesStore())

const searchInput = ref('')
const orderView = useLocalStorage<'cards' | 'list'>('orders:view', 'cards')
const pageSize = useLocalStorage<number>('orders:page-size', DEFAULT_PAGE_SIZE)

// Колоночные фильтры
const filterDeliveryTypes = ref<string[]>([])
const filterPaymentTypes = ref<string[]>([])
const filterBranchIds = ref<string[]>([])

// Сортировка
const sortBy = ref('created_at')
const sortDir = ref<'asc' | 'desc'>('desc')

const activeFilterCount = computed(
  () => (searchInput.value ? 1 : 0)
    + filterDeliveryTypes.value.length
    + filterPaymentTypes.value.length
    + filterBranchIds.value.length,
)

const hasAnyFilter = computed(() => activeFilterCount.value > 0)

const clearFilters = () => {
  searchInput.value = ''
  filterDeliveryTypes.value = []
  filterPaymentTypes.value = []
  filterBranchIds.value = []
}

const {
  orders,
  loading,
  updateStatus: updateOrderStatus,
  page,
  total,
  pendingUpdate,
  refresh,
  realtimeVersion,
} = useOrders(tenantIdRef, statusIdRef, {
  branchId: branchIdRef,
  statuses: computed(() => statuses.value),
  search: searchInput,
  deliveryTypes: filterDeliveryTypes,
  excludeDeliveryTypes: ['dine_in'],
  paymentTypes: filterPaymentTypes,
  filterBranchIds,
  sortBy,
  sortDir,
  pageSize,
})

watch(realtimeVersion, () => emit('ordersChanged'))

const updatingIds = reactive(new Set<string>())

const tableData = computed(() => {
  // reactive Set не тригерит computed при add/delete без явного обращения к .size
  void updatingIds.size

  return orders.value
})

const handleStatusChange = async (id: string, statusId: string) => {
  updatingIds.add(id)
  try {
    await updateOrderStatus(id, statusId)
    emit('ordersChanged')
  } finally {
    updatingIds.delete(id)
  }
}

const getBranchName = (branchId: string | null | undefined) => {
  if (!branchId) return undefined

  return branchStore.branches.find((b) => b.id === branchId)?.name
}

const getRowProps = (row: Order) => ({
  style: 'cursor: pointer',
  onClick: (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.n-checkbox')) return
    openEditModal(row)
  },
})

const { isOpen: modalOpen, data: modalOrder, open: openModal } = useDrawer<Order>()
const openEditModal = (order: Order) => openModal(order)
const openCreateModal = () => openModal()
const handleOrderSaved = () => emit('ordersChanged')

// Выбор строк
const checkedRowKeys = ref<string[]>([])

watch(
  [() => statusIdRef.value, page, searchInput, filterDeliveryTypes, filterPaymentTypes, filterBranchIds],
  () => { checkedRowKeys.value = [] },
)

// Bulk смена статуса
const bulkStatusId = ref<string | null>(null)
const bulkUpdating = ref(false)

const kitchenAutoStatuses = computed(() => getKitchenAutoStatuses(tenantStore.tenant.kitchenConfig))

const statusOptions = computed(() => {
  if (!checkedRowKeys.value.length) return []

  const selectedOrders = orders.value.filter((o) => checkedRowKeys.value.includes(o.id))
  const groups = selectedOrders.map((o) => o.statusGroup ?? 'new')
  const allowedSets = groups.map((g) => getAllowedStatuses(g, statuses.value))
  const intersection = allowedSets.reduce((acc, set) => acc.filter((s) => set.some((x) => x.id === s.id)))

  return intersection
    .filter((s) => !kitchenAutoStatuses.value.includes(s.id))
    .map((s) => ({ label: s.name, value: s.id }))
})

const applyBulkStatus = async () => {
  if (!bulkStatusId.value) return
  bulkUpdating.value = true
  try {
    await Promise.all(checkedRowKeys.value.map((id) => updateOrderStatus(id, bulkStatusId.value!)))
    emit('ordersChanged')
    checkedRowKeys.value = []
    bulkStatusId.value = null
  } finally {
    bulkUpdating.value = false
  }
}

// CSV экспорт
const exportCsv = () => {
  const selected = orders.value.filter((o) => checkedRowKeys.value.includes(o.id))
  const headers = ['#', 'Клиент', 'Телефон', 'Состав', 'Сумма', 'Доставка', 'Оплата', 'Дата']
  const rows = selected.map((o) => [
    o.orderNumber ?? o.id,
    o.customerName,
    formatPhone(o.customerPhone),
    o.items.map((i) => `${i.dishName} x${i.quantity}`).join('; '),
    o.total,
    DELIVERY_TYPE_LABELS[o.deliveryType] ?? o.deliveryType,
    PAYMENT_TYPE_LABELS[o.paymentType] ?? o.paymentType,
    new Date(o.createdAt).toLocaleString('ru'),
  ])
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Обработчики событий таблицы
const handleSorterChange = (sorterInfo: unknown) => {
  const s = sorterInfo as { columnKey?: string | number; order?: 'ascend' | 'descend' | false } | null

  if (!s || !s.order) {
    sortBy.value = 'created_at'
    sortDir.value = 'desc'

    return
  }
  sortBy.value = String(s.columnKey)
  sortDir.value = s.order === 'ascend' ? 'asc' : 'desc'
}

const handleFiltersChange = (filterState: Record<string, (string | number)[] | null>) => {
  filterDeliveryTypes.value = (filterState['deliveryType'] as string[] | null) ?? []
  filterPaymentTypes.value = (filterState['paymentType'] as string[] | null) ?? []
  filterBranchIds.value = (filterState['branchId'] as string[] | null) ?? []
}

const visibleColumns = ref<string[]>(COLUMN_OPTIONS.map((c) => c.value))

const { columns } = useOrderTable({
  statuses: statuses.value,
  sortBy,
  sortDir,
  filterDeliveryTypes,
  filterPaymentTypes,
  filterBranchIds,
  branchId: branchIdRef,
  branches: branchStore.branches,
  visibleColumns,
  getBranchName,
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.order-list-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
}

.selection-bar {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-12);
  background: var(--color-primary-light);
  border-radius: var(--radius-8);
  flex-wrap: wrap;
}

.selection-count {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  margin-right: var(--space-4);
}

.bulk-status-select {
  width: 180px;
}

.pending-banner {
  padding: var(--space-8) var(--space-16);
  background: var(--color-warning-light);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-8);
  font-size: var(--font-size-base);
  color: var(--color-text);
  cursor: pointer;
  text-align: center;

  &:hover {
    background: var(--color-warning-hover, oklch(92% 0.07 85));
  }
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);
  align-items: start;

  @include mq-m {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
}

:deep(.customer-name) {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
}

:deep(.customer-phone) {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

:deep(.col-time) {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

:deep(.col-total) {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-title);
}

:deep(.col-actions) {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}
</style>
