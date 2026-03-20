<template>
  <div class="checkout-summary-root">
    <SfOrderTotals
      :subtotal="subtotal"
      :delivery-fee="deliveryFee"
      :discount-amount="discountAmount"
      :total="total"
      :currency="currency"
    />
    <p v-if="error" class="submit-error">{{ error }}</p>
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
  total: number
  currency: string
  error?: string
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  error: '',
  loading: false,
})

const emit = defineEmits<{
  submit: []
}>()
</script>

<style scoped lang="scss">
.checkout-summary-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.submit-btn {
  width: 100%;
}

.submit-error {
  font-size: 13px;
  color: var(--color-error, #ef4444);
  margin: 0;
}
</style>
