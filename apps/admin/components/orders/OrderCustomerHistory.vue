<template>
  <div class="customer-history-root">
    <div
      v-for="o in orders"
      :key="o.id"
      class="history-row"
      @click="router.push(`/orders/${o.id}`)"
    >
      <span class="history-num">#{{ o.orderNumber }}</span>
      <UiTag
        v-if="getStatusById(o.status)"
        size="small"
        round
        :type="STATUS_GROUP_TAG_TYPES[getStatusById(o.status)!.groupType]"
      >{{ getStatusById(o.status)!.name }}</UiTag>
      <span class="history-items">{{ o.items.map((i) => i.dishName).join(', ') }}</span>
      <span class="history-total">{{ o.total }} ₽</span>
      <span class="history-date">{{ formatDate(o.createdAt) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from '#imports'
import { UiTag } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { storeToRefs } from 'pinia'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'

defineProps<{
  orders: Order[]
}>()

const router = useRouter()
const { statuses } = storeToRefs(useOrderStatusesStore())

const getStatusById = (statusId: string) => statuses.value.find((s) => s.id === statusId) ?? null

const formatDate = (iso: string) => {
  const d = new Date(iso)

  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
</script>

<style scoped lang="scss">
.customer-history-root {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--color-bg-hover);
  }
}

.history-num {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-title);
  min-width: 40px;
}

.history-items {
  flex: 1;
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  white-space: nowrap;
}

.history-date {
  font-size: 12px;
  color: var(--color-text-hint);
  white-space: nowrap;
}
</style>
