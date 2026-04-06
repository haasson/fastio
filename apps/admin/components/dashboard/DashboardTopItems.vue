<template>
  <UiCard class="chart-card">
    <div class="header">
      <UiText size="small" class="label">{{ title }}</UiText>
      <UiSelect
        v-if="categories.length > 1"
        v-model:value="selectedCategoryKey"
        :options="categoryOptions"
        size="small"
        class="category-select"
      />
    </div>
    <div v-if="loading" class="chart-placeholder">
      <UiSkeleton height="200" />
    </div>
    <div v-else-if="topItems.length > 0" class="chart-wrap">
      <apexchart
        type="bar"
        :height="chartHeight"
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
import { UiCard, UiText, UiSkeleton, UiSelect } from '@fastio/ui'
import type { BusinessType } from '@fastio/shared'

const isDark = inject<Ref<boolean>>('isDark', ref(false))

type Props = {
  items: Array<{ name: string; count: number; categoryName: string | null }>
  loading: boolean
  businessType: BusinessType | null
  categories: string[]
}

const props = defineProps<Props>()

const selectedCategoryKey = ref<string>('')
const selectedCategory = computed(() => selectedCategoryKey.value || null)

const categoryOptions = computed(() => [
  { label: 'Все категории', value: '' },
  ...props.categories.map((c) => ({ label: c, value: c })),
])

const topItems = computed(() => {
  const list = selectedCategory.value
    ? props.items.filter((i) => i.categoryName === selectedCategory.value)
    : props.items

  return list.slice(0, 10)
})

const title = computed(() => {
  if (selectedCategory.value) return `Топ: ${selectedCategory.value}`
  if (props.businessType === 'services') return 'Топ услуг'
  if (props.businessType === 'retail') return 'Топ товаров'

  return 'Топ блюд'
})

const chartHeight = computed(() => Math.max(180, topItems.value.length * 36 + 40))

const series = computed(() => [
  {
    name: 'Количество',
    data: topItems.value.map((i) => i.count),
  },
])

const chartOptions = computed(() => ({
  chart: {
    toolbar: { show: false },
    fontFamily: 'inherit',
    background: 'transparent',
  },
  theme: { mode: isDark.value ? 'dark' as const : 'light' as const },
  colors: ['#6366f1'],
  plotOptions: {
    bar: {
      horizontal: true,
      borderRadius: 4,
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: isDark.value ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    xaxis: { lines: { show: false } },
  },
  xaxis: {
    categories: topItems.value.map((i) => i.name),
    labels: { style: { fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: { fontSize: '11px' },
      maxWidth: 160,
    },
  },
  tooltip: {
    y: { formatter: (v: number) => `${v} шт.` },
  },
}))
</script>

<style scoped>
.chart-card {
  gap: 8px;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.label {
  color: var(--color-text-hint);
}

.category-select {
  min-width: 140px;
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
