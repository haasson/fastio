<template>
  <UiCard class="assembly-card-root" :class="{ 'assembly-card--done': allDone, 'assembly-card--cancelled': cancelled }">
    <div class="header">
      <span class="order-id">#{{ orderNumber }}</span>
      <UiTag
        v-if="!cancelled"
        size="small"
        :type="deliveryTagType"
        empty
        round
        :icon="deliveryIcon"
      >
        {{ DELIVERY_TYPE_LABELS[deliveryType] }}
      </UiTag>
      <UiTag
        v-if="cancelled"
        size="small"
        type="error"
        round
      >Заказ отменён</UiTag>
      <span class="progress">{{ doneCount }}/{{ activeItems.length }}</span>
    </div>

    <div v-if="kitchenItems.length" class="section">
      <span class="section-title">С кухни</span>
      <div class="dishes">
        <div v-for="item in kitchenItems" :key="item.id" class="dish-row">
          <UiTag
            size="small"
            :type="statusTagType(item.status)"
            round
          >
            {{ STATUS_LABELS[item.status] }}
          </UiTag>
          <span class="dish-name" :class="{ 'dish-name--cancelled': item.status === 'cancelled' }">{{ item.dishName }}</span>
          <span v-if="item.comboName" class="combo-hint">({{ item.comboName }})</span>
        </div>
      </div>
    </div>

    <div v-if="selfCollectItems.length" class="section">
      <span class="section-title">Собрать самому</span>
      <div class="dishes">
        <div v-for="item in selfCollectItems" :key="item.id" class="dish-row">
          <UiCheckbox
            :model-value="item.status === 'done' || item.status === 'served'"
            @update:model-value="$emit('collectItem', item.id, $event)"
          >
            <span class="dish-name" :class="{ 'dish-name--done': item.status === 'done' || item.status === 'served' }">{{ item.dishName }}</span>
            <span v-if="item.comboName" class="combo-hint">({{ item.comboName }})</span>
          </UiCheckbox>
          <div v-if="hasCustomizations(item)" class="tags">
            <UiTag
              v-for="mod in item.modifiers"
              :key="`m-${mod.optionName}`"
              size="small"
              round
            >
              {{ mod.optionName }}
            </UiTag>
            <UiTag
              v-for="addon in item.addons"
              :key="`a-${addon.addonName}`"
              size="small"
              type="primary"
              round
            >
              + {{ addon.addonName }}
            </UiTag>
            <UiTag
              v-for="ing in item.removedIngredients"
              :key="`r-${ing}`"
              size="small"
              type="error"
              round
            >
              − {{ ing }}
            </UiTag>
          </div>
        </div>
        <div v-for="item in cancelledSelfCollectItems" :key="item.id" class="dish-row">
          <UiTag size="small" type="error" round>{{ STATUS_LABELS.cancelled }}</UiTag>
          <span class="dish-name dish-name--cancelled">{{ item.dishName }}</span>
          <span v-if="item.comboName" class="combo-hint">({{ item.comboName }})</span>
        </div>
      </div>
    </div>

    <UiButton
      v-if="cancelled"
      type="default"
      size="small"
      @click="$emit('dismissed', orderId)"
    >Убрать</UiButton>
    <UiButton
      v-else-if="allDone"
      type="success"
      size="small"
      @click="$emit('assembled', orderId, deliveryType)"
    >Собрано</UiButton>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KitchenQueueItem, KitchenQueueStatus } from '@fastio/shared'
import { UiCard, UiTag, UiButton, UiCheckbox } from '@fastio/ui'
import type { IconName } from '@fastio/icons'
import { DELIVERY_TYPE_LABELS, DELIVERY_TYPE_ICONS } from '~/config/retail/order-options'

const props = defineProps<{
  orderId: string
  orderNumber: string | null
  deliveryType: string
  items: KitchenQueueItem[]
  cancelled?: boolean
}>()

defineEmits<{
  assembled: [orderId: string, deliveryType: string]
  collectItem: [id: string, collected: boolean]
  dismissed: [orderId: string]
}>()

const STATUS_LABELS: Record<KitchenQueueStatus, string> = {
  queued: 'В очереди',
  in_progress: 'Готовится',
  done: 'Готово',
  served: 'Подано',
  cancelled: 'Отменено',
}

const kitchenItems = computed(() => props.items.filter((i) => !i.skipKitchen))
const selfCollectItems = computed(() => props.items.filter((i) => i.skipKitchen && i.status !== 'cancelled'))
const cancelledSelfCollectItems = computed(() => props.items.filter((i) => i.skipKitchen && i.status === 'cancelled'))

const activeItems = computed(() => props.items.filter((i) => i.status !== 'cancelled'))
const doneCount = computed(() => props.items.filter((i) => i.status === 'done' || i.status === 'served').length)
const allDone = computed(() => activeItems.value.length > 0 && activeItems.value.every((i) => i.status === 'done' || i.status === 'served'))

const deliveryIcon = computed(() => (DELIVERY_TYPE_ICONS[props.deliveryType] ?? 'cart') as IconName)
const deliveryTagType = computed(() => props.deliveryType === 'delivery' ? 'primary' as const : 'success' as const)

const hasCustomizations = (item: KitchenQueueItem) => item.modifiers.length > 0 || item.addons.length > 0 || item.removedIngredients.length > 0

const statusTagType = (status: KitchenQueueStatus) => {
  if (status === 'done' || status === 'served') return 'success' as const
  if (status === 'in_progress') return 'warning' as const
  if (status === 'cancelled') return 'error' as const

  return 'default' as const
}
</script>

<style scoped lang="scss">
.assembly-card-root {
  gap: var(--space-8);

  &.assembly-card--done {
    border: 1.5px solid var(--color-success);
  }

  &.assembly-card--cancelled {
    border: 1.5px solid var(--color-error);
    background: var(--color-error-bg);
    opacity: 0.85;
  }
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.order-id {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-title);
  flex: 1;
}

.progress {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-hint);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.section-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-hint);
}

.dishes {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.dish-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.dish-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);

  &--done {
    text-decoration: line-through;
    color: var(--color-text-hint);
  }

  &--cancelled {
    text-decoration: line-through;
    color: var(--color-error);
  }
}

.combo-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding-left: var(--space-24);
}
</style>
