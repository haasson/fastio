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
    <FsButton size="large" class="submit-btn" data-testid="checkout-submit" :loading="loading" @click="emit('submit')">
      Оформить заказ
    </FsButton>
    <p v-if="legalInfoComplete" class="consent-note">
      Нажимая кнопку «Оформить заказ», вы соглашаетесь с
      <a href="/privacy" target="_blank">обработкой персональных данных</a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { FsButton } from '@fastio/public-ui'
import SfOrderTotals from '~/shared/ui/sf/domain/SfOrderTotals.vue'
import useLegalCompliance from '~/shared/composables/useLegalCompliance'

const { legalInfoComplete } = useLegalCompliance()

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
  color: var(--color-error);
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.consent-note {
  @include consent-note;
}
</style>
