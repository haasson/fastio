<template>
  <UiCard class="assembly-card-root" :class="{ 'assembly-card--done': allDone }">
    <div class="header">
      <span class="order-id">#{{ orderId.slice(0, 6).toUpperCase() }}</span>
      <UiTag
        size="small"
        :type="deliveryTagType"
        empty
        round
        :icon="deliveryIcon"
      >
        {{ DELIVERY_TYPE_LABELS[deliveryType] }}
      </UiTag>
      <span class="progress">{{ doneCount }}/{{ items.length }}</span>
    </div>

    <div class="dishes">
      <div v-for="item in items" :key="item.id" class="dish-row">
        <UiTag
          size="small"
          :type="statusTagType(item.status)"
          round
        >
          {{ STATUS_LABELS[item.status] }}
        </UiTag>
        <span class="dish-name">{{ item.dishName }}</span>
        <span v-if="item.comboName" class="combo-hint">({{ item.comboName }})</span>
      </div>
    </div>

    <UiButton
      v-if="allDone"
      type="success"
      size="small"
      @click="$emit('assembled')"
    >Собрано</UiButton>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KitchenQueueItem, KitchenQueueStatus } from '@fastio/shared'
import { UiCard, UiTag, UiButton } from '@fastio/ui'
import type { IconName } from '@fastio/icons'
import { DELIVERY_TYPE_LABELS, DELIVERY_TYPE_ICONS } from '~/config/order-options'

const props = defineProps<{
  orderId: string
  deliveryType: string
  items: KitchenQueueItem[]
}>()

defineEmits<{ assembled: [] }>()

const STATUS_LABELS: Record<KitchenQueueStatus, string> = {
  queued: 'В очереди',
  in_progress: 'Готовится',
  done: 'Готово',
  served: 'Подано',
  cancelled: 'Отменено',
}

const doneCount = computed(() => props.items.filter((i) => i.status === 'done' || i.status === 'served').length)
const allDone = computed(() => doneCount.value === props.items.length)

const deliveryIcon = computed(() => (DELIVERY_TYPE_ICONS[props.deliveryType] ?? 'cart') as IconName)
const deliveryTagType = computed(() => props.deliveryType === 'delivery' ? 'primary' as const : 'success' as const)

const statusTagType = (status: KitchenQueueStatus) => {
  if (status === 'done' || status === 'served') return 'success' as const
  if (status === 'in_progress') return 'warning' as const
  if (status === 'cancelled') return 'error' as const

  return 'default' as const
}
</script>

<style scoped lang="scss">
.assembly-card-root {
  gap: 10px;

  &.assembly-card--done {
    border: 1.5px solid var(--color-success);
  }
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-id {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-title);
  flex: 1;
}

.progress {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-hint);
}

.dishes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dish-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dish-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.combo-hint {
  font-size: 12px;
  color: var(--color-text-hint);
}
</style>
