<template>
  <div class="checkout-summary-root">
    <SfOrderTotals
      :subtotal="subtotal"
      :delivery-fee="deliveryFee"
      :discount-amount="discountAmount"
      :discount-label="discountLabel"
      :total="total"
      :currency="currency"
    />
    <ul v-if="errors?.length" class="submit-errors">
      <li v-for="err in errors" :key="err">{{ err }}</li>
    </ul>
    <FsButton size="large" class="submit-btn" :loading="loading" @click="emit('submit')">
      Оформить заказ
    </FsButton>
  </div>
</template>

<script setup lang="ts">
import { FsButton } from '@fastio/public-ui'
import SfOrderTotals from '~/components/sf/domain/SfOrderTotals.vue'

type Props = {
  subtotal: number
  deliveryFee: number
  discountAmount: number
  discountLabel?: string | null
  total: number
  currency: string
  errors?: string[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  errors: () => [],
  loading: false,
})

const emit = defineEmits<{
  submit: []
}>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.checkout-summary-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.submit-btn {
  width: 100%;
}

.submit-errors {
  @include text-xs;
  color: var(--color-error, #ef4444);
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
