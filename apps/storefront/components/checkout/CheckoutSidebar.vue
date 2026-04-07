<template>
  <div class="checkout-sidebar">
    <FsCard class="sidebar-card">
      <div class="sidebar-body">
        <FsHeading as="h6" class="sidebar-title">Ваш заказ</FsHeading>
        <SfOrderItemsList :items="cart.items" :currency="currency" />
        <FsDivider spacing="none" />
        <CheckoutSummary
          :subtotal="cart.subtotal"
          :delivery-fee="checkout.deliveryFee"
          :discount-amount="checkout.discountAmount"
          :total="checkout.orderTotal"
          :currency="currency"
          :errors="errors"
          :loading="loading"
          @submit="emit('submit')"
        />
      </div>
    </FsCard>
  </div>
</template>

<script setup lang="ts">
import { useCartStore } from '~/stores/cart'
import { useCheckoutStore } from '~/stores/checkout'
import { FsHeading, FsCard, FsDivider } from '@fastio/public-ui'
import SfOrderItemsList from '~/components/sf/domain/SfOrderItemsList.vue'
import CheckoutSummary from '~/components/checkout/CheckoutSummary.vue'

type Props = {
  currency: string
  errors?: string[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), { errors: () => [], loading: false })

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
