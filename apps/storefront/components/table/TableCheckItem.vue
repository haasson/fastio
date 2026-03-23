<template>
  <div class="check-item-root">
    <div class="item-main">
      <div class="item-info">
        <FsText variant="body-sm" :weight="500">
          {{ item.dishName }}
          <span v-if="item.quantity > 1" class="qty">&times;{{ item.quantity }}</span>
        </FsText>
        <FsText v-if="summary" variant="caption" color="secondary">{{ summary }}</FsText>
      </div>
      <FsText variant="body-sm" :weight="500">{{ itemTotal }} {{ currency }}</FsText>
    </div>
    <div class="status-bar" :class="statusColor" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FsText } from '@fastio/public-ui'
import { getItemUnitPrice, getItemSummary } from '@fastio/shared'
import type { CheckItem } from '~/stores/table'
import { useCurrency } from '~/composables/useCurrency'

const props = defineProps<{
  item: CheckItem
  statusColor: 'warning' | 'info' | 'success'
}>()

const currency = useCurrency()

const itemTotal = computed(() => getItemUnitPrice(props.item) * props.item.quantity)

const summary = computed(() => getItemSummary(props.item))
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.check-item-root {
  @include flex-row(8px);
  align-items: stretch;
  padding: 10px 12px;
  background: var(--color-surface);
  border-radius: var(--radius-card);
}

.item-main {
  @include flex-between(8px);
  align-items: flex-start;
  flex: 1;
}

.item-info {
  @include flex-col(2px);
  min-width: 0;
}

.qty {
  color: var(--color-text-muted);
}

.status-bar {
  width: 4px;
  border-radius: 2px;
  flex-shrink: 0;

  &.warning { background: var(--color-warning); }
  &.info { background: var(--color-info); }
  &.success { background: var(--color-success); }
}
</style>
