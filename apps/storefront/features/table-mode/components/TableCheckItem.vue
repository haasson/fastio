<template>
  <div class="check-item-root" :class="tone">
    <div class="item-info">
      <FsText variant="body-sm" :weight="500">
        {{ item.dishName }}
        <span v-if="item.quantity > 1" class="qty">&times;{{ item.quantity }}</span>
      </FsText>
      <FsText v-if="summary" variant="caption" color="secondary">{{ summary }}</FsText>
    </div>
    <FsText variant="body-sm" :weight="600">{{ formatPrice(itemTotal) }}</FsText>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FsText } from '@fastio/public-ui'
import { getItemUnitPrice, getItemSummary, formatPrice } from '@fastio/shared'
import type { CheckItem } from '../stores/table'

const props = defineProps<{
  item: CheckItem
  tone: 'ready' | 'progress'
}>()

const itemTotal = computed(() => getItemUnitPrice(props.item) * props.item.quantity)

const summary = computed(() => getItemSummary(props.item))
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.check-item-root {
  @include flex-between(8px);
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: var(--radius-card);
  border-left: 3px solid transparent;

  &.ready {
    background: color-mix(in srgb, var(--color-success) 8%, var(--color-surface));
    border-left-color: var(--color-success);
  }

  // Внутри блока «Готовится» — плоские строки, фон/рамку даёт сам блок.
  &.progress {
    padding: 6px 4px;
    border-left: none;
  }
}

.item-info {
  @include flex-col(2px);
  min-width: 0;
}

.qty {
  color: var(--color-text-secondary);
}
</style>
