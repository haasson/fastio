<template>
  <div class="stats-root">
    <UiCard class="stat-card">
      <UiText size="small" class="label">Выручка</UiText>
      <div v-if="loading" class="value-placeholder">
        <UiSkeleton :width="120" :height="32" />
      </div>
      <UiTitle v-else size="h3" class="value">{{ formatPrice(revenue) }}</UiTitle>
      <UiText size="small" class="sub">
        <span class="count">{{ ordersCount }}</span>
        {{ ordersCountWord }}
      </UiText>
    </UiCard>

    <UiCard class="stat-card">
      <UiText size="small" class="label">Средний чек</UiText>
      <div v-if="loading" class="value-placeholder">
        <UiSkeleton :width="100" :height="32" />
      </div>
      <UiTitle v-else size="h3" class="value">
        {{ ordersCount > 0 ? formatPrice(avgOrderValue) : '—' }}
      </UiTitle>
      <UiText size="small" class="sub">за период</UiText>
    </UiCard>

    <UiCard class="stat-card">
      <UiText size="small" class="label">Заказы</UiText>
      <div v-if="loading" class="value-placeholder">
        <UiSkeleton :width="80" :height="32" />
      </div>
      <UiTitle v-else size="h3" class="value">{{ ordersCount }}</UiTitle>
      <UiText size="small" class="sub">за период</UiText>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatPrice, pluralize } from '@fastio/shared'
import { UiCard, UiText, UiTitle, UiSkeleton } from '@fastio/ui'

type Props = {
  revenue: number
  ordersCount: number
  avgOrderValue: number
  loading: boolean
}

const props = defineProps<Props>()

const ordersCountWord = computed(() => pluralize(props.ordersCount, 'заказ', 'заказа', 'заказов'),
)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.stats-root {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @include mq-m {
    grid-template-columns: repeat(3, 1fr);
  }
}

.stat-card {
  gap: 4px;
}

.label {
  color: var(--color-text-hint);
}

.value {
  margin: 4px 0;
}

.value-placeholder {
  margin: 4px 0;
}

.sub {
  color: var(--color-text-secondary);
}

.count {
  font-weight: 600;
  color: var(--color-text);
}
</style>
