<template>
  <UiCard class="chart-card">
    <UiText size="small" class="label">Типы заказов</UiText>
    <div v-if="loading" class="chart-placeholder">
      <UiSkeleton height="200" />
    </div>
    <div v-else-if="hasData" class="chart-wrap">
      <apexchart
        type="donut"
        height="220"
        :options="chartOptions"
        :series="series"
      />
    </div>
    <div v-else class="empty">
      <UiText size="small" class="empty-text">Нет заказов за период</UiText>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import { pluralize } from '@fastio/shared'
import { UiCard, UiText, UiSkeleton } from '@fastio/ui'

const isDark = inject<Ref<boolean>>('isDark', ref(false))

type Props = {
  delivery: number
  pickup: number
  dineIn: number
  loading: boolean
}

const props = defineProps<Props>()

const hasData = computed(() => props.delivery + props.pickup + props.dineIn > 0)

const visibleTypes = computed(() => {
  const types = [
    { label: 'Доставка', value: props.delivery, color: '#6366f1' },
    { label: 'Самовывоз', value: props.pickup, color: '#10b981' },
    { label: 'В зале', value: props.dineIn, color: '#f59e0b' },
  ]

  return types.filter((t) => t.value > 0)
})

const series = computed(() => visibleTypes.value.map((t) => t.value))

const chartOptions = computed(() => ({
  chart: {
    toolbar: { show: false },
    fontFamily: 'inherit',
    background: 'transparent',
  },
  theme: { mode: isDark.value ? 'dark' as const : 'light' as const },
  colors: visibleTypes.value.map((t) => t.color),
  labels: visibleTypes.value.map((t) => t.label),
  legend: {
    position: 'bottom' as const,
    fontSize: '12px',
    fontFamily: 'inherit',
  },
  dataLabels: {
    style: { fontSize: '12px', fontFamily: 'inherit' },
  },
  plotOptions: {
    pie: {
      donut: { size: '60%' },
    },
  },
  stroke: { width: 0 },
  tooltip: {
    y: { formatter: (v: number) => `${v} ${pluralize(v, 'заказ', 'заказа', 'заказов')}` },
  },
}))
</script>

<style scoped>
.chart-card {
  gap: 8px;
  overflow: hidden;
}

.label {
  color: var(--color-text-hint);
}

.chart-placeholder {
  height: 220px;
  display: flex;
  align-items: center;
}

.empty {
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  color: var(--color-text-hint);
}
</style>
