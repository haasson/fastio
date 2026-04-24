<template>
  <div class="orders-root" @click="resetOrderCount">
    <OrderStatusList
      v-model="selectedStatusId"
      :order-counts="orderCounts"
    />

    <OrderList
      v-if="selectedStatusId"
      :tenant-id="tenantId"
      :status-id="selectedStatusId"
      :branch-id="branchId"
      @orders-changed="fetchCounts"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useNewOrderCounter } from '~/composables/data/useNewOrderCounter'
import OrderStatusList from '~/components/orders/OrderStatusList.vue'
import OrderList from '~/components/orders/OrderList.vue'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useOrderCounts } from '~/composables/data/useOrderCounts'

const { count: newOrderCount, reset: resetOrderCount } = useNewOrderCounter()

resetOrderCount()

const tenantStore = useTenantStore()
const branchStore = useBranchStore()

const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const branchId = computed(() => branchStore.currentBranchId)

const { statuses } = storeToRefs(useOrderStatusesStore())
const selectedStatusId = ref<string | null>(null)

watch(statuses, (list) => {
  if (!selectedStatusId.value && list.length > 0) {
    selectedStatusId.value = list[0].id
  }
}, { immediate: true })

const { counts: orderCounts, fetchCounts } = useOrderCounts(tenantId, branchId, { excludeDeliveryTypes: ['dine_in'] })

watch(newOrderCount, fetchCounts)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.orders-root {
  @include flex-col(var(--space-20));
}
</style>
