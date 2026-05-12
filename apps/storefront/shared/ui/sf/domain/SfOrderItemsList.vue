<template>
  <div class="order-items-root">
    <div v-for="item in items" :key="item.id ?? item.dishName" class="order-item">
      <div class="item-main">
        <span class="item-name">{{ item.dishName }} × {{ item.quantity }}</span>
        <span class="item-price">{{ getItemUnitPrice(item) * item.quantity }} {{ currency }}</span>
      </div>
      <p v-if="getItemSummaryText(item)" class="item-detail">{{ getItemSummaryText(item) }}</p>
      <p v-if="item.status === 'pending'" class="item-detail item-pending">Ожидает подтверждения</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OrderItem } from '@fastio/shared'
import { getItemUnitPrice, getItemSummary } from '@fastio/shared'

type Props = {
  items: OrderItem[]
  currency: string
}

defineProps<Props>()

function getItemSummaryText(item: OrderItem) {
  return getItemSummary(item)
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.order-items-root {
  @include flex-col(12px);
}

.order-item {
  @include flex-col(3px);
}

.item-main {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  @include text-caption;
}

.item-name {
  color: var(--color-text);
  font-weight: 500;
  @include flex-fill;
}

.item-price {
  color: var(--color-text);
  font-weight: 600;
  flex-shrink: 0;
}

.item-detail {
  @include text-xs;
  color: var(--color-text-secondary);
  margin: 0;
}

.item-pending {
  color: var(--color-warning);
  font-weight: 500;
}
</style>
