<template>
  <div class="checkout-sidebar">
    <SfCard class="sidebar-card">
      <div class="sidebar-body">
        <SfHeading as="h6" class="sidebar-title">Ваш заказ</SfHeading>
        <SfOrderItemsList :items="cart.items" :currency="currency" />
        <SfDivider spacing="none" />
        <CheckoutSummary
          :subtotal="cart.subtotal"
          :delivery-fee="checkout.deliveryFee"
          :discount-amount="checkout.discountAmount"
          :total="checkout.orderTotal"
          :currency="currency"
          :error="error"
          :loading="loading"
          @submit="emit('submit')"
        />
      </div>
    </SfCard>
  </div>
</template>

<script setup lang="ts">
import { useCartStore } from '~/stores/cart'
import { useCheckoutStore } from '~/stores/checkout'
import SfHeading from '~/components/sf/typography/SfHeading.vue'
import SfCard from '~/components/sf/layout/SfCard.vue'
import SfOrderItemsList from '~/components/sf/domain/SfOrderItemsList.vue'
import SfDivider from '~/components/sf/base/SfDivider.vue'
import CheckoutSummary from '~/components/checkout/CheckoutSummary.vue'

type Props = {
  currency: string
  error?: string
  loading?: boolean
}

withDefaults(defineProps<Props>(), { error: '', loading: false })

const emit = defineEmits<{ submit: [] }>()

const cart = useCartStore()
const checkout = useCheckoutStore()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.checkout-sidebar {
  @include md {
    position: sticky;
    top: 80px;
  }
}

.sidebar-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar-title {
  margin: 0;
}

</style>
