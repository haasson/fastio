<template>
  <div class="billing-root">
    <BillingSummary />
    <PlanCards />
    <TransactionHistory />
  </div>
</template>

<script setup lang="ts">
import BillingSummary from '~/features/billing/components/BillingSummary.vue'
import PlanCards from '~/features/billing/components/PlanCards.vue'
import TransactionHistory from '~/features/billing/components/TransactionHistory.vue'
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.billing-root {
  @include flex-col(var(--space-24));
}
</style>
