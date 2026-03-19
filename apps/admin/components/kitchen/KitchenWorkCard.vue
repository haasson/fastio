<template>
  <UiCard class="work-card-root" :class="[urgencyClass]">
    <div class="header">
      <span class="order-id">#{{ item.orderId.slice(0, 6).toUpperCase() }}</span>
      <UiTag
        v-if="showDeliveryType"
        size="small"
        :type="deliveryTagType"
        empty
        round
        :icon="deliveryIcon"
      >
        {{ DELIVERY_TYPE_LABELS[item.deliveryType] }}
      </UiTag>
      <UiTag
        size="small"
        :type="urgencyTagType"
        :empty="urgencyLevel === 'normal'"
        round
        :class="{ 'timer--critical': urgencyLevel === 'critical' }"
      >
        {{ elapsed }}
      </UiTag>
    </div>

    <div class="dish-row">
      <div class="dish-name">{{ item.dishName }}</div>
      <UiTag
        v-if="item.assignedAt"
        size="small"
        type="warning"
        round
      >
        в работе {{ cookingElapsed }}
      </UiTag>
    </div>

    <div v-if="hasCustomizations" class="tags">
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

    <div class="footer">
      <UiButton type="default" @click="$emit('unclaim')">Вернуть</UiButton>
      <UiButton type="success" class="btn-done" @click="$emit('complete')">Готово</UiButton>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KitchenQueueItem } from '@fastio/shared'
import { UiCard, UiTag, UiButton } from '@fastio/ui'
import type { IconName } from '@fastio/icons'
import { DELIVERY_TYPE_LABELS, DELIVERY_TYPE_ICONS } from '~/config/order-options'

const props = defineProps<{
  item: KitchenQueueItem
  elapsed: string
  cookingElapsed: string
  urgencyLevel: 'normal' | 'warning' | 'critical'
  showDeliveryType?: boolean
}>()

defineEmits<{
  complete: []
  unclaim: []
}>()

const hasCustomizations = computed(() => props.item.modifiers.length > 0 || props.item.addons.length > 0 || props.item.removedIngredients.length > 0)

const urgencyClass = computed(() => {
  if (props.urgencyLevel === 'critical') return 'card--critical'
  if (props.urgencyLevel === 'warning') return 'card--warning'

  return ''
})

const deliveryIcon = computed(() => (DELIVERY_TYPE_ICONS[props.item.deliveryType] ?? 'cart') as IconName)

const deliveryTagType = computed(() => props.item.deliveryType === 'delivery' ? 'primary' as const : 'success' as const)

const urgencyTagType = computed(() => {
  if (props.urgencyLevel === 'critical') return 'error' as const
  if (props.urgencyLevel === 'warning') return 'warning' as const

  return 'default' as const
})
</script>

<style scoped lang="scss">
.work-card-root {
  gap: 10px;

  &.card--warning { border: 1.5px solid var(--color-warning); }
  &.card--critical { border: 1.5px solid var(--color-error); }
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-id {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-hint);
  flex: 1;
}

.timer--critical {
  animation: pulse 1.5s ease-in-out infinite;
}

.dish-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dish-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-title);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-done {
  flex: 1;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
