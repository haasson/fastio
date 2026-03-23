<template>
  <div class="order-items-root">
    <div v-for="item in items" :key="item.id ?? item.dishName" class="order-item">
      <div class="item-main">
        <span class="item-name">{{ item.dishName }} × {{ item.quantity }}</span>
        <span class="item-price">{{ getItemUnitPrice(item) * item.quantity }} {{ currency }}</span>
      </div>
      <p v-if="modifiersSummary(item)" class="item-detail">{{ modifiersSummary(item) }}</p>
      <p v-if="item.removedIngredients?.length" class="item-detail item-removed">
        Убрать: {{ item.removedIngredients.join(', ') }}
      </p>
      <p v-if="addonsSummary(item)" class="item-detail">{{ addonsSummary(item) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OrderItem } from '@fastio/shared'
import { getItemUnitPrice } from '@fastio/shared'

type Props = {
  items: OrderItem[]
  currency: string
}

defineProps<Props>()

function modifiersSummary(item: OrderItem) {
  return item.modifiers?.map((m) => m.optionName).join(' · ') ?? ''
}

function addonsSummary(item: OrderItem) {
  return item.addons?.map((a) => `+ ${a.addonName}`).join(' · ') ?? ''
}
</script>

<style scoped lang="scss">
.order-items-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.item-main {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}

.item-name {
  color: var(--color-text);
  font-weight: 500;
  flex: 1;
  min-width: 0;
}

.item-price {
  color: var(--color-text);
  font-weight: 600;
  flex-shrink: 0;
}

.item-detail {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0;
}

.item-removed {
  color: var(--color-text-muted);
}
</style>
