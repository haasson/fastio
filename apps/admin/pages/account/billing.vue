<template>
  <div class="billing-root">
    <BillingSummary />
    <PlanCards />
    <TransactionHistory />
  </div>
</template>

<script setup lang="ts">
import BillingSummary from '~/components/billing/BillingSummary.vue'
import PlanCards from '~/components/billing/PlanCards.vue'
import TransactionHistory from '~/components/billing/TransactionHistory.vue'
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.billing-root {
  @include flex-col(var(--space-24));
}
</style>
