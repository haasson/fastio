<template>
  <div class="billing-root">
    <BillingSummary />
    <PlanChanger @changed="txHistory?.reload()" />
    <TransactionHistory ref="txHistory" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BillingSummary from '~/components/billing/BillingSummary.vue'
import PlanChanger from '~/components/billing/PlanChanger.vue'
import TransactionHistory from '~/components/billing/TransactionHistory.vue'

const txHistory = ref<InstanceType<typeof TransactionHistory> | null>(null)
</script>

<style scoped>
.billing-root {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
