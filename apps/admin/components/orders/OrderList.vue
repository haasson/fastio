<template>
  <div class="order-list-root">
    <UiSectionHeader label="Заказы">
      <UiSegmentedControl
        v-model="orderView"
        :items="[{ label: 'Карточки', value: 'cards' }, { label: 'Список', value: 'list' }]"
        size="medium"
      />
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
          :statuses="statuses"
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
          :statuses="statuses"
          :branch-name="branchId === null ? getBranchName(order.branchId) : undefined"
          @status-change="handleStatusChange"
          @open-edit="openEditModal"
        />
      </div>
    </template>

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
import { ref, computed, reactive } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { UiSegmentedControl } from '@fastio/ui'
import type { Order, OrderStatus } from '@fastio/shared'
import OrderCard from '~/components/orders/OrderCard.vue'
import OrderRow from '~/components/orders/OrderRow.vue'
import OrderEditModal from '~/components/orders/OrderEditModal.vue'
import UiAppEmpty from '~/components/ui/AppEmpty.vue'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import { useOrders } from '~/composables/useOrders'
import { useBranchStore } from '~/stores/branch'

const props = defineProps<{
  tenantId: string
  statusId: string | null
  statuses: OrderStatus[]
  branchId: string | null
}>()

const emit = defineEmits<{
  ordersChanged: []
}>()

const tenantIdRef = computed(() => props.tenantId)
const statusIdRef = computed(() => props.statusId)
const branchIdRef = computed(() => props.branchId)

const branchStore = useBranchStore()

const statusesRef = computed(() => props.statuses)

const { orders, loading, updateStatus: updateOrderStatus } = useOrders(tenantIdRef, statusIdRef, branchIdRef, statusesRef)

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

const editModalOpen = ref(false)
const editingOrder = ref<Order | null>(null)

const openEditModal = (order: Order) => {
  editingOrder.value = order
  editModalOpen.value = true
}

const handleOrderSaved = () => {
  emit('ordersChanged')
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/media-queries' as *;

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
