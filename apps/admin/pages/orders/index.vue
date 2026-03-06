<template>
  <div class="orders-root">
    <!-- Фильтр по статусам -->
    <div class="statuses-section">
      <UiSectionHeader label="Статусы" />

      <UiTabs v-model="filter" :tabs="statusTabs" />
    </div>

    <!-- Заголовок списка -->
    <div class="list-header">
      <span class="list-title">Заказы</span>
      <UiSegmentedControl
        v-model="orderView"
        :items="[{ label: 'Карточки', value: 'cards' }, { label: 'Список', value: 'list' }]"
        size="medium"
      />
    </div>

    <!-- Загрузка -->
    <div v-if="loading" class="state-msg">Загрузка…</div>

    <!-- Пусто -->
    <UiAppEmpty v-else-if="orders.length === 0" icon="orders" text="Заказов пока нет" />

    <template v-else>
      <!-- Карточки -->
      <div v-if="orderView === 'cards'" class="grid">
        <OrderCard
          v-for="order in orders"
          :key="order.id"
          :order="order"
          :updating="updatingIds.has(order.id)"
          :statuses="statuses"
          :branch-name="branchStore.currentBranchId === null ? getBranchName(order.branchId) : undefined"
          @status-change="handleStatusChange"
          @open-edit="openEditModal"
        />
      </div>

      <!-- Список -->
      <div v-else class="rows">
        <OrderRow
          v-for="order in orders"
          :key="order.id"
          :order="order"
          :updating="updatingIds.has(order.id)"
          :statuses="statuses"
          :branch-name="branchStore.currentBranchId === null ? getBranchName(order.branchId) : undefined"
          @status-change="handleStatusChange"
          @open-edit="openEditModal"
        />
      </div>
    </template>

    <OrderStatusModal
      v-model="statusModalOpen"
      :status="editingStatus"
      @save="handleStatusSave"
    />

    <OrderEditModal
      v-model="editModalOpen"
      :order="editingOrder"
      :statuses="statuses"
      :tenant-id="tenantId"
      @saved="handleOrderSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { definePageMeta, useNuxtApp } from '#imports'
import { useLocalStorage } from '@vueuse/core'
import { UiTabs, UiSegmentedControl } from '@fastio/ui'
import type { Order, OrderStatus, OrderStatusGroup } from '@fastio/shared'
import OrderCard from '~/components/orders/OrderCard.vue'
import OrderRow from '~/components/orders/OrderRow.vue'
import OrderStatusModal from '~/components/orders/OrderStatusModal.vue'
import OrderEditModal from '~/components/orders/OrderEditModal.vue'
import UiAppEmpty from '~/components/ui/AppEmpty.vue'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import { useOrders } from '~/composables/useOrders'
import { ordersApi } from '~/utils/api/orders'
import { useOrderStatuses } from '~/composables/useOrderStatuses'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'

definePageMeta({ middleware: 'auth' })

const { $supabase } = useNuxtApp()
const tenantStore = useTenantStore()
const branchStore = useBranchStore()

tenantStore.init()

const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const branchId = computed(() => branchStore.currentBranchId)

const { statuses, add: addStatus, update: updateStatus } = useOrderStatuses(tenantId)
const orderView = useLocalStorage<'cards' | 'list'>('orders:view', 'cards')

const filter = ref<string>('')

watch(statuses, (list) => {
  if ((!filter.value || !list.find((s) => s.id === filter.value)) && list.length) {
    filter.value = list[0].id
  }
}, { immediate: true })

const { orders, loading, updateStatus: updateOrderStatus } = useOrders(tenantId, filter, branchId)

const statusCounts = ref<Record<string, number>>({})

const fetchCounts = async () => {
  if (!tenantId.value) return
  statusCounts.value = await ordersApi.counts($supabase, tenantId.value, branchId.value)
}

watch([tenantId, branchId], fetchCounts, { immediate: true })

const statusTabs = computed(() => statuses.value.map((s) => ({
  value: s.id,
  label: s.name,
  type: STATUS_GROUP_TAG_TYPES[s.groupType],
  count: statusCounts.value[s.id] ?? 0,
})),
)

const updatingIds = reactive(new Set<string>())

const handleStatusChange = async (id: string, statusId: string) => {
  updatingIds.add(id)
  try {
    await updateOrderStatus(id, statusId)
    await fetchCounts()
  } finally {
    updatingIds.delete(id)
  }
}

const getBranchName = (branchId: string | null | undefined) => {
  if (!branchId) return undefined

  return branchStore.branches.find((b) => b.id === branchId)?.name
}

const editModalOpen = ref(false)
const editingOrder = ref<Order | null>(null)

const openEditModal = (order: Order) => {
  editingOrder.value = order
  editModalOpen.value = true
}

const handleOrderSaved = (updatedOrder: Order) => {
  const i = orders.value.findIndex((o) => o.id === updatedOrder.id)

  if (i === -1) return
  if (updatedOrder.status !== filter.value) {
    orders.value.splice(i, 1)
  } else {
    orders.value[i] = updatedOrder
  }
  fetchCounts()
}

const statusModalOpen = ref(false)
const editingStatus = ref<OrderStatus | null>(null)

const openStatusModal = (status: OrderStatus | null) => {
  editingStatus.value = status
  statusModalOpen.value = true
}

const handleStatusSave = async (data: { name: string; groupType: OrderStatusGroup }) => {
  if (editingStatus.value) {
    await updateStatus(editingStatus.value.id, data)
  } else {
    await addStatus(data)
  }
  statusModalOpen.value = false
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/media-queries' as *;

.orders-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.statuses-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.list-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.state-msg {
  padding: 60px 0;
  color: var(--color-text-tertiary);
  text-align: center;
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
</style>
