<template>
  <div class="statuses-root">
    <div class="toolbar">
      <UiButton type="primary" icon="plus" @click="openModal(null)">
        Добавить статус
      </UiButton>
    </div>

    <OrdersStatusList
      :statuses="statuses"
      :loading="showSkeleton"
      @edit="openModal"
      @delete="confirmDelete"
      @reorder="reorder"
    />

    <OrdersStatusFormModal
      v-model="modalOpen"
      :status="editingItem"
      :all-statuses="statuses"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { UiButton } from '@fastio/ui'
import { storeToRefs } from 'pinia'
import type { OrderStatus, OrderStatusGroup } from '@fastio/shared'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useItemManager } from '~/composables/ui/useItemManager'
import OrdersStatusList from '~/components/orders/StatusList.vue'
import OrdersStatusFormModal from '~/components/orders/StatusFormModal.vue'

const statusesStore = useOrderStatusesStore()
const { statuses, loading } = storeToRefs(statusesStore)
const { add, update, remove, reorder } = statusesStore

const { showSkeleton, modalOpen, editingItem, openModal, confirmDelete } = useItemManager<OrderStatus>({
  loading,
  remove: async (id: string) => await remove(id),
  confirmTitle: 'Удалить статус?',
})

const handleSave = async (data: { name: string; groupType: OrderStatusGroup; quickActions: string[] }) => {
  if (editingItem.value) {
    await update(editingItem.value.id, data)
  } else {
    await add({ name: data.name, groupType: data.groupType, quickActions: data.quickActions })
  }
}
</script>

<style scoped lang="scss">
.statuses-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
