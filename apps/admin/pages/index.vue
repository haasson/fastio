<template>
  <div class="dashboard-root">
    <DashboardSubscriptionBanner />

    <div class="page-header">
      <UiTitle size="h4">Дашборд</UiTitle>

      <div class="controls">
        <UiSegmentedControl
          v-model="period"
          :items="periodItems"
          size="small"
        />

        <UiSelect
          v-if="branches.length > 1 && isOwner"
          v-model:value="selectedBranchKey"
          :options="branchOptions"
          size="small"
          class="branch-select"
        />
      </div>
    </div>

    <!-- Нет ни одного модуля заказов — онбординг -->
    <DashboardOnboarding v-if="noOrderModules" />

    <template v-else>
      <!-- Основная статистика -->
      <DashboardStats
        :revenue="stats.revenue.value"
        :orders-count="stats.ordersCount.value"
        :avg-order-value="stats.avgOrderValue.value"
        :loading="stats.loading.value"
      />

      <!-- Чарты -->
      <div class="charts-grid">
        <DashboardRevenueChart
          :data="stats.revenueByDay.value"
          :loading="stats.loading.value"
          class="chart-revenue"
        />
        <DashboardOrderTypes
          v-if="hasMultipleOrderTypes"
          :delivery="stats.ordersByType.value.delivery"
          :pickup="stats.ordersByType.value.pickup"
          :dine-in="stats.ordersByType.value.dine_in"
          :loading="stats.loading.value"
          class="chart-types"
        />
      </div>

      <!-- Топ позиций -->
      <DashboardTopItems
        :items="stats.allItemCounts.value"
        :categories="stats.categories.value"
        :loading="stats.loading.value"
        :business-type="tenant?.businessType ?? null"
      />

      <!-- Живые данные -->
      <div class="live-grid">
        <DashboardActiveOrders
          v-if="hasAnyOrderModule"
          :tenant-id="tenantId"
          :branch-id="selectedBranchId"
        />
        <DashboardTables
          v-if="modules.dineIn?.value.enabled"
          :tenant-id="tenantId"
        />
        <DashboardReservations
          v-if="modules.reservations?.value.enabled"
          :tenant-id="tenantId"
          :branch-id="selectedBranchId"
        />
        <DashboardKitchen
          v-if="modules.kitchen?.value.enabled"
          :tenant-id="tenantId"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiTitle, UiSegmentedControl, UiSelect } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useModules } from '~/composables/plan/useModules'
import { useDashboardStats } from '~/composables/data/useDashboardStats'
import type { DashboardPeriod } from '~/composables/data/useDashboardStats'

import DashboardSubscriptionBanner from '~/components/dashboard/DashboardSubscriptionBanner.vue'
import DashboardOnboarding from '~/components/dashboard/DashboardOnboarding.vue'
import DashboardStats from '~/components/dashboard/DashboardStats.vue'
import DashboardRevenueChart from '~/components/dashboard/DashboardRevenueChart.vue'
import DashboardOrderTypes from '~/components/dashboard/DashboardOrderTypes.vue'
import DashboardTopItems from '~/components/dashboard/DashboardTopItems.vue'
import DashboardActiveOrders from '~/components/dashboard/DashboardActiveOrders.vue'
import DashboardTables from '~/components/dashboard/DashboardTables.vue'
import DashboardReservations from '~/components/dashboard/DashboardReservations.vue'
import DashboardKitchen from '~/components/dashboard/DashboardKitchen.vue'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()

const { tenant } = storeToRefs(tenantStore)
const { branches, hasBranches } = storeToRefs(branchStore)
const { isOwner } = storeToRefs(tenantStore)

const tenantId = computed(() => tenant.value?.id ?? '')

const modules = useModules()

const period = ref<DashboardPeriod>('today')

const periodItems = [
  { label: 'Сегодня', value: 'today' },
  { label: 'Неделя', value: 'week' },
  { label: 'Месяц', value: 'month' },
]

const selectedBranchKey = ref<string>('')

const branchOptions = computed(() => [
  { label: 'Все филиалы', value: '' },
  ...branches.value.map((b) => ({ label: b.name, value: b.id })),
])

const selectedBranchId = computed(() => selectedBranchKey.value || null)

const stats = useDashboardStats(tenantId, period, selectedBranchId)

const noOrderModules = computed(() => !modules.delivery?.value.enabled
  && !modules.pickup?.value.enabled
  && !modules.dineIn?.value.enabled,
)

const hasAnyOrderModule = computed(() => modules.delivery?.value.enabled
  || modules.pickup?.value.enabled
  || modules.dineIn?.value.enabled,
)

const hasMultipleOrderTypes = computed(() => [
  modules.delivery?.value.enabled,
  modules.pickup?.value.enabled,
  modules.dineIn?.value.enabled,
].filter(Boolean).length > 1)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.dashboard-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 32px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.branch-select {
  min-width: 160px;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @include mq-l {
    grid-template-columns: 1fr auto;
    align-items: start;

    .chart-revenue {
      min-width: 0;
    }

    .chart-types {
      width: 280px;
    }
  }
}

.live-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @include mq-m {
    grid-template-columns: repeat(2, 1fr);
  }

  @include mq-l {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}
</style>
