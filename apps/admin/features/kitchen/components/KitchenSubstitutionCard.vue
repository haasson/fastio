<template>
  <UiCard class="sub-card-root">
    <div class="header">
      <span class="order-id">#{{ cancelledItem.orderNumber }}</span>
      <UiTag size="small" type="error" round>Заказ отменён</UiTag>
    </div>

    <div class="dish-name">{{ cancelledItem.dishName }}</div>

    <div class="notice">
      В очереди похожее блюдо из заказа #{{ candidate.orderNumber }} — отличия:
    </div>

    <div v-if="hasDiffs" class="diffs">
      <UiTag
        v-for="addon in diff.addedAddons"
        :key="`+a-${addon}`"
        size="small"
        type="primary"
        round
      >
        + добавить {{ addon }}
      </UiTag>
      <UiTag
        v-for="addon in diff.removedAddons"
        :key="`-a-${addon}`"
        size="small"
        type="error"
        round
      >
        − не добавлять {{ addon }}
      </UiTag>
      <UiTag
        v-for="ing in diff.newlyRemovedIngredients"
        :key="`-i-${ing}`"
        size="small"
        type="error"
        round
      >
        убрать {{ ing }}
      </UiTag>
      <UiTag
        v-for="ing in diff.restoredIngredients"
        :key="`+i-${ing}`"
        size="small"
        type="warning"
        round
      >
        вернуть {{ ing }}
      </UiTag>
    </div>

    <div class="footer">
      <UiButton type="default" @click="$emit('skip')">Выбросить</UiButton>
      <UiButton type="primary" class="btn-take" @click="$emit('take')">Взять</UiButton>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KitchenQueueItem, DishDiff } from '@fastio/shared'
import { UiCard, UiTag, UiButton } from '@fastio/ui'

const props = defineProps<{
  cancelledItem: KitchenQueueItem
  candidate: KitchenQueueItem
  diff: DishDiff
}>()

const hasDiffs = computed(() => props.diff.addedAddons.length > 0
  || props.diff.removedAddons.length > 0
  || props.diff.newlyRemovedIngredients.length > 0
  || props.diff.restoredIngredients.length > 0,
)

defineEmits<{ take: []; skip: [] }>()
</script>

<style scoped lang="scss">
.sub-card-root {
  gap: var(--space-8);
  border: 1.5px solid var(--color-warning);
  background: var(--color-warning-light);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.order-id {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-hint);
  flex: 1;
}

.dish-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-title);
  text-decoration: line-through;
  opacity: 0.7;
}

.notice {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.diffs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.footer {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.btn-take {
  flex: 1;
}
</style>
