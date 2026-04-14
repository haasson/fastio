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

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.billing-root {
  @include flex-col(var(--space-24));
}
</style>
