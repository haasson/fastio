<template>
  <div class="order-list-root">
    <UiSectionHeader title="Заказы">
      <template #left>
        <div class="header-left">
          <UiSegmentedControl
            v-model="orderView"
            :items="[{ label: 'Карточки', value: 'cards' }, { label: 'Таблица', value: 'list' }]"
            size="medium"
          />
          <UiDivider vertical />
          <UiInput
            v-model:value="searchInput"
            placeholder="Имя или телефон…"
            clearable
            size="medium"
            class="search"
          />
          <div v-if="activeFilterCount > 0" class="reset-wrap">
            <UiButton size="medium" ghost @click="clearFilters">Сбросить</UiButton>
            <UiCounter
              :value="activeFilterCount"
              type="primary"
              size="tiny"
              class="reset-count"
            />
          </div>
          <template v-if="orderView === 'list'">
            <UiDivider vertical />
            <UiMenuDropdown :items="columnMenuItems" @item-click="toggleColumn">
              <template #trigger>
                <UiButton size="medium" ghost>Столбцы {{ visibleColumns.length }}/{{ COLUMN_OPTIONS.length }}</UiButton>
              </template>
            </UiMenuDropdown>
          </template>
        </div>
      </template>
      <template #right>
        <UiButton
          type="primary"
          size="medium"
          icon="plus"
          @click="openCreateModal()"
        >Новый заказ</UiButton>
      </template>
    </UiSectionHeader>

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
        :row-key="(row) => row.id"
        :checked-row-keys="checkedRowKeys"
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

    <OrderModal
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
import { UiButton, UiCounter, UiDataTable, UiDivider, UiEmpty, UiInput, UiMenuDropdown, UiPagination, UiSectionHeader, UiSegmentedControl, UiSelect, UiSkeleton } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { formatPhone } from '@fastio/shared'
import OrderCard from '~/components/orders/OrderCard.vue'
import OrderModal from '~/components/orders/OrderModal.vue'
import { useOrders } from '~/composables/data/useOrders'
import { DEFAULT_PAGE_SIZE } from '~/utils/api/orders'
import { storeToRefs } from 'pinia'
import { useBranchStore } from '~/stores/branch'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import useDrawer from '~/composables/ui/useDrawer'
import { useOrderTable, COLUMN_OPTIONS } from '~/composables/ui/useOrderTable'
import { DELIVERY_TYPE_LABELS, PAYMENT_TYPE_LABELS } from '~/config/order-options'

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
const statusOptions = computed(() => statuses.value.map((s) => ({ label: s.name, value: s.id })))

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
    o.id.slice(0, 6).toUpperCase(),
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

const { columns, visibleColumns, columnMenuItems, toggleColumn } = useOrderTable({
  statuses: statuses.value,
  sortBy,
  sortDir,
  filterDeliveryTypes,
  filterPaymentTypes,
  filterBranchIds,
  branchId: branchIdRef,
  branches: branchStore.branches,
  onEdit: openEditModal,
  getBranchName,
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.order-list-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search {
  width: 220px;
}

.reset-wrap {
  position: relative;

  .reset-count {
    position: absolute;
    top: -6px;
    right: -6px;
    pointer-events: none;
  }
}

.selection-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-primary-light);
  border-radius: 8px;
  flex-wrap: wrap;
}

.selection-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  margin-right: 4px;
}

.bulk-status-select {
  width: 180px;
}

.pending-banner {
  padding: 10px 16px;
  background: var(--color-warning-light);
  border: 1px solid var(--color-warning);
  border-radius: 8px;
  font-size: 13px;
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
  gap: 14px;
  align-items: start;

  @include mq-m {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
}

:deep(.customer-name) {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
}

:deep(.customer-phone) {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

:deep(.col-time) {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

:deep(.col-total) {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-title);
}

:deep(.col-actions) {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
