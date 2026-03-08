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
import { definePageMeta } from '#imports'
import { useNewOrderCounter } from '~/composables/useNewOrderCounter'
import OrderStatusList from '~/components/orders/OrderStatusList.vue'
import OrderList from '~/components/orders/OrderList.vue'
import { useSupabaseApi } from '~/composables/useSupabaseApi'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useOrderStatusesStore } from '~/stores/order-statuses'

definePageMeta({ middleware: 'auth' })

const { count: newOrderCount, reset: resetOrderCount } = useNewOrderCounter()

resetOrderCount()

const api = useSupabaseApi()
const tenantStore = useTenantStore()
const branchStore = useBranchStore()

tenantStore.init()

const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const branchId = computed(() => branchStore.currentBranchId)

const { statuses } = useOrderStatusesStore()
const selectedStatusId = ref<string | null>(null)

watch(statuses, (list) => {
  if (!selectedStatusId.value && list.length > 0) {
    selectedStatusId.value = list[0].id
  }
}, { immediate: true })

const orderCounts = ref<Record<string, number>>({})

const fetchCounts = async () => {
  if (!tenantId.value) return
  orderCounts.value = await api.orders.counts(tenantId.value, branchId.value)
}

watch([tenantId, branchId], fetchCounts, { immediate: true })
watch(newOrderCount, fetchCounts)
</script>

<style scoped lang="scss">
.orders-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
