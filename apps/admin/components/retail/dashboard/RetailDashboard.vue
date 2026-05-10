<template>
  <div class="dashboard-root">
    <DashboardSubscriptionBanner />

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

    <DashboardOnboarding v-if="noOrderModules" />

    <template v-else>
      <DashboardStats
        :revenue="stats.revenue.value"
        :orders-count="stats.ordersCount.value"
        :avg-order-value="stats.avgOrderValue.value"
        :loading="stats.loading.value"
      />

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

      <DashboardTopItems
        :items="stats.allItemCounts.value"
        :categories="stats.categories.value"
        :loading="stats.loading.value"
        :business-type="businessType"
      />

      <div class="live-grid">
        <DashboardActiveOrders
          v-if="hasAnyOrderModule"
          :tenant-id="tenantId"
          :branch-id="selectedBranchId"
        />
        <DashboardTables
          v-if="gate.dineIn.value.enabled"
          :tenant-id="tenantId"
        />
        <DashboardReservations
          v-if="gate.reservations.value.enabled"
          :tenant-id="tenantId"
          :branch-id="selectedBranchId"
          :timezone="tenantStore.timezone"
        />
        <DashboardKitchen
          v-if="gate.kitchen.value.enabled"
          :tenant-id="tenantId"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiSegmentedControl, UiSelect } from '@fastio/ui'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { useGateRetail } from '~/shared/plan/useGate.retail'
import { useDashboardStats, type DashboardPeriod } from '~/composables/retail/useDashboardStats'

import DashboardSubscriptionBanner from '~/components/retail/dashboard/DashboardSubscriptionBanner.vue'
import DashboardOnboarding from '~/components/retail/dashboard/DashboardOnboarding.vue'
import DashboardStats from '~/components/retail/dashboard/DashboardStats.vue'
import DashboardRevenueChart from '~/components/retail/dashboard/DashboardRevenueChart.vue'
import DashboardOrderTypes from '~/components/retail/dashboard/DashboardOrderTypes.vue'
import DashboardTopItems from '~/components/retail/dashboard/DashboardTopItems.vue'
import DashboardActiveOrders from '~/components/retail/dashboard/DashboardActiveOrders.vue'
import DashboardTables from '~/components/retail/dashboard/DashboardTables.vue'
import DashboardReservations from '~/components/retail/dashboard/DashboardReservations.vue'
import DashboardKitchen from '~/components/retail/dashboard/DashboardKitchen.vue'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()

const { tenantId, businessType, isOwner } = storeToRefs(tenantStore)
const { branches } = storeToRefs(branchStore)

const gate = useGateRetail()

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

const noOrderModules = computed(() => !gate.delivery.value.enabled
  && !gate.pickup.value.enabled
  && !gate.dineIn.value.enabled,
)

const hasAnyOrderModule = computed(() => gate.delivery.value.enabled
  || gate.pickup.value.enabled
  || gate.dineIn.value.enabled,
)

const hasMultipleOrderTypes = computed(() => [
  gate.delivery.value.enabled,
  gate.pickup.value.enabled,
  gate.dineIn.value.enabled,
].filter(Boolean).length > 1)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.dashboard-root {
  @include flex-col(var(--space-16));
  padding-bottom: var(--space-32);
}

.controls {
  @include flex-row;
  flex-wrap: wrap;
}

.branch-select {
  min-width: 160px;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

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
  gap: var(--space-12);

  @include mq-m {
    grid-template-columns: repeat(2, 1fr);
  }

  @include mq-l {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}
</style>
