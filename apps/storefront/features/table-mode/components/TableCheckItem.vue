<template>
  <div class="check-item-root">
    <div class="item-info">
      <FsText variant="body-sm" :weight="500">{{ item.dishName }}</FsText>
      <FsText v-if="summary" variant="caption" color="secondary">{{ summary }}</FsText>
    </div>
    <div class="item-amount">
      <FsText v-if="item.quantity > 1" variant="caption" color="secondary" class="qty">{{ item.quantity }}&nbsp;шт</FsText>
      <FsText variant="body-sm" :weight="600">{{ formatPrice(itemTotal) }}</FsText>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FsText } from '@fastio/public-ui'
import { getItemUnitPrice, getItemSummary, formatPrice } from '@fastio/shared'
import type { CheckItem } from '../stores/table'

const props = defineProps<{
  item: CheckItem
}>()

const itemTotal = computed(() => getItemUnitPrice(props.item) * props.item.quantity)

const summary = computed(() => getItemSummary(props.item))
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.check-item-root {
  @include flex-between(12px);
  align-items: baseline;
  padding: 10px 0;
}

.item-info {
  @include flex-col(2px);
  min-width: 0;
}

.item-amount {
  @include flex-row(8px);
  align-items: baseline;
  flex-shrink: 0;
}

.qty {
  white-space: nowrap;
}
</style>
