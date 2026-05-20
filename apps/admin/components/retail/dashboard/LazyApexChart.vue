<template>
  <component
    :is="ApexChart"
    v-if="ApexChart"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { shallowRef, onMounted } from 'vue'

// vue3-apexcharts весит ~518 kB (gzip ~140 kB). Грузим только на дашборде.
// Используем shallowRef + динамический import вместо defineAsyncComponent,
// потому что vue3-apexcharts на default export цепляет глобальный install,
// и нам нужен сам компонент VueApexCharts (default).

defineOptions({ inheritAttrs: false })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ApexChart = shallowRef<any>(null)

onMounted(async () => {
  const mod = await import('vue3-apexcharts')

  ApexChart.value = mod.default
})
</script>
