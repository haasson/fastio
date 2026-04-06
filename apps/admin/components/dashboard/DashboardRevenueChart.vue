<template>
  <UiCard class="chart-card">
    <UiText size="small" class="label">Выручка по дням</UiText>
    <div v-if="loading" class="chart-placeholder">
      <UiSkeleton height="180" />
    </div>
    <div v-else-if="hasData" class="chart-wrap">
      <apexchart
        type="area"
        height="200"
        :options="chartOptions"
        :series="series"
      />
    </div>
    <div v-else class="empty">
      <UiText size="small" class="empty-text">Нет данных за период</UiText>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import { formatPrice } from '@fastio/shared'
import { UiCard, UiText, UiSkeleton } from '@fastio/ui'

const isDark = inject<Ref<boolean>>('isDark', ref(false))

type Props = {
  data: Array<{ date: string; value: number }>
  loading: boolean
}

const props = defineProps<Props>()

const hasData = computed(() => props.data.some((d) => d.value > 0))

const series = computed(() => [
  {
    name: 'Выручка',
    data: props.data.map((d) => d.value),
  },
])

const chartOptions = computed(() => ({
  chart: {
    toolbar: { show: false },
    sparkline: { enabled: false },
    fontFamily: 'inherit',
    background: 'transparent',
  },
  theme: { mode: isDark.value ? 'dark' as const : 'light' as const },
  colors: ['#6366f1'],
  stroke: { curve: 'smooth' as const, width: 2 },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.4,
      opacityTo: 0.05,
      stops: [0, 90, 100],
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: isDark.value ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    padding: { left: 8, right: 8 },
  },
  xaxis: {
    categories: props.data.map((d) => {
      const [, month, day] = d.date.split('-')

      return `${day}.${month}`
    }),
    labels: { style: { fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: { fontSize: '11px' },
      formatter: (v: number) => formatPrice(v),
    },
  },
  tooltip: {
    y: { formatter: (v: number) => formatPrice(v) },
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

.chart-wrap {
  margin: 0 -8px -8px;
}

.chart-placeholder {
  height: 200px;
  display: flex;
  align-items: center;
}

.empty {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  color: var(--color-text-hint);
}
</style>
