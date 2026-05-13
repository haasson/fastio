<template>
  <div class="stats-root">
    <UiStatBlock
      label="Выручка"
      :loading="loading"
      :value="formatPrice(revenue)"
      :loading-width="120"
    >
      <template #sub>
        <span class="count">{{ ordersCount }}</span>
        {{ ordersCountWord }}
      </template>
    </UiStatBlock>

    <UiStatBlock
      label="Средний чек"
      :loading="loading"
      :value="ordersCount > 0 ? formatPrice(avgOrderValue) : '—'"
      :loading-width="100"
      sub="за период"
    />

    <UiStatBlock
      label="Заказы"
      :loading="loading"
      :value="ordersCount"
      :loading-width="80"
      sub="за период"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatPrice, pluralize } from '@fastio/shared'
import { UiStatBlock } from '@fastio/ui'

type Props = {
  revenue: number
  ordersCount: number
  avgOrderValue: number
  loading: boolean
}

const props = defineProps<Props>()

const ordersCountWord = computed(() => pluralize(props.ordersCount, 'заказ', 'заказа', 'заказов'))
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.stats-root {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq-m {
    grid-template-columns: repeat(3, 1fr);
  }
}

.count {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}
</style>
