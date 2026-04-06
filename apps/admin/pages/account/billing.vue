<template>
  <div class="billing-root">
    <BillingSummary />
    <TransactionHistory />
  </div>
</template>

<script setup lang="ts">
import BillingSummary from '~/components/billing/BillingSummary.vue'
import TransactionHistory from '~/components/billing/TransactionHistory.vue'
</script>

<style scoped>
.billing-root {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
