<template>
  <div class="order-totals-root">
    <div class="totals-row"><span>Подытог</span><span>{{ subtotal }} {{ currency }}</span></div>
    <div v-if="deliveryFee > 0" class="totals-row"><span>Доставка</span><span>{{ deliveryFee }} {{ currency }}</span></div>
    <div v-if="discountAmount > 0" class="totals-row totals-discount"><span>{{ discountLabel ?? 'Скидка' }}</span><span>−{{ discountAmount }} {{ currency }}</span></div>
    <div class="totals-row totals-total"><span>Итого</span><span>{{ total }} {{ currency }}</span></div>
  </div>
</template>

<script setup lang="ts">
type Props = {
  subtotal: number
  deliveryFee: number
  discountAmount: number
  discountLabel?: string | null
  total: number
  currency: string
}

defineProps<Props>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.order-totals-root {
  @include flex-col(8px);
}

.totals-row {
  display: flex;
  justify-content: space-between;
  @include text-caption;
  color: var(--color-text-secondary);
}

.totals-discount span:last-child {
  color: color-mix(in srgb, var(--color-success) 80%, #000);
  font-weight: 600;
}

.totals-total {
  @include text-body-sm(700);
  color: var(--color-text);
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}
</style>
