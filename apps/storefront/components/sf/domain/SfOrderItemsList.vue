<template>
  <div class="order-items-root">
    <div v-for="item in items" :key="item.id ?? item.dishName" class="order-item">
      <span class="item-name">{{ item.dishName }} × {{ item.quantity }}</span>
      <span class="item-price">{{ getItemUnitPrice(item) * item.quantity }} {{ currency }}</span>
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
</script>

<style scoped lang="scss">
.order-items-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.item-name {
  color: var(--color-text-secondary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-price {
  color: var(--color-text);
  font-weight: 500;
  flex-shrink: 0;
}
</style>
