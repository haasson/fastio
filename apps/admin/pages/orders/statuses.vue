<template>
  <div class="statuses-root">
    <div class="toolbar">
      <UiButton
        data-tour="orders-statuses-add"
        type="primary"
        icon="plus"
        @click="openModal(null)"
      >
        Добавить статус
      </UiButton>
    </div>

    <OrdersStatusList
      data-tour="orders-status-list"
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
import { useOrderStatusesStore } from '~/features/orders'
import { useTenantStore } from '~/shared/stores/tenant'
import { useItemManager } from '~/composables/ui/useItemManager'
import OrdersStatusList from '~/features/orders/components/StatusList.vue'
import OrdersStatusFormModal from '~/features/orders/components/StatusFormModal.vue'

const statusesStore = useOrderStatusesStore()
const { statuses, loading } = storeToRefs(statusesStore)
const { add, update, remove, reorder } = statusesStore
const tenantStore = useTenantStore()

const { showSkeleton, modalOpen, editingItem, openModal, confirmDelete } = useItemManager<OrderStatus>({
  loading,
  remove: async (id: string) => await remove(id),
  confirmTitle: 'Удалить статус?',
  beforeDelete: (id) => {
    const kitchen = tenantStore.tenant.kitchenConfig
    const scheduling = tenantStore.tenant.orderSchedulingConfig

    const usages: string[] = []

    if (kitchen?.sourceStatusId === id) usages.push('источник для кухни')
    if (kitchen?.cookingStatusId === id) usages.push('«Готовится» кухни')
    if (kitchen?.completedStatusMap?.delivery === id) usages.push('«Готово» кухни (доставка)')
    if (kitchen?.completedStatusMap?.pickup === id) usages.push('«Готово» кухни (самовывоз)')
    if (kitchen?.completedStatusMap?.dine_in === id) usages.push('«Готово» кухни (зал)')
    if (scheduling?.holdingStatusId === id) usages.push('статус ожидания запланированных заказов')
    if (scheduling?.nextStatusId === id) usages.push('статус после выпуска запланированного заказа')

    if (usages.length === 0) return undefined

    return {
      disabled: true,
      alert: `Этот статус используется в автоматизации: ${usages.join(', ')}. Сначала измените настройки в разделе Заказы → Настройки.`,
    }
  },
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
@use '@fastio/styles/mixins/layout' as *;

.statuses-root {
  @include flex-col(var(--space-16));
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
