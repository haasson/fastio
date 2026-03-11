<template>
  <div class="order-list-root">
    <UiSectionHeader title="Заказы">
      <template #left>
        <UiSegmentedControl
          v-model="orderView"
          :items="[{ label: 'Карточки', value: 'cards' }, { label: 'Список', value: 'list' }]"
          size="medium"
        />
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
          :branch-name="branchId === null ? getBranchName(order.branchId) : undefined"
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
          :branch-name="branchId === null ? getBranchName(order.branchId) : undefined"
          @status-change="handleStatusChange"
          @open-edit="openEditModal"
        />
      </div>
    </template>

    <OrderEditModal
      v-model="editModalOpen"
      :order="editingOrder"
      :tenant-id="tenantId"
      @saved="handleOrderSaved"
    />

    <OrderCreateModal
      v-model="createModalOpen"
      :tenant-id="tenantId"
      :branch-id="branchId"
      @created="handleOrderCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { UiSegmentedControl, UiButton } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import OrderCard from '~/components/orders/OrderCard.vue'
import OrderRow from '~/components/orders/OrderRow.vue'
import OrderEditModal from '~/components/orders/OrderEditModal.vue'
import OrderCreateModal from '~/components/orders/OrderCreateModal.vue'
import UiAppEmpty from '~/components/ui/AppEmpty.vue'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import { useOrders } from '~/composables/data/useOrders'
import { useBranchStore } from '~/stores/branch'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import useDrawer from '~/composables/ui/useDrawer'

const props = defineProps<{
  tenantId: string
  statusId: string | null
  branchId: string | null
}>()

const emit = defineEmits<{
  ordersChanged: []
}>()

const tenantIdRef = computed(() => props.tenantId)
const statusIdRef = computed(() => props.statusId)
const branchIdRef = computed(() => props.branchId)

const branchStore = useBranchStore()
const { statuses } = useOrderStatusesStore()

const { orders, loading, updateStatus: updateOrderStatus } = useOrders(tenantIdRef, statusIdRef, branchIdRef, computed(() => statuses))

const orderView = useLocalStorage<'cards' | 'list'>('orders:view', 'cards')
const updatingIds = reactive(new Set<string>())

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

const { isOpen: editModalOpen, data: editingOrder, open: openEditModal } = useDrawer<Order>()
const { isOpen: createModalOpen, open: openCreateModal, close: closeCreateModal } = useDrawer()

const handleOrderSaved = () => {
  emit('ordersChanged')
}

const handleOrderCreated = () => {
  closeCreateModal()
  emit('ordersChanged')
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.order-list-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
