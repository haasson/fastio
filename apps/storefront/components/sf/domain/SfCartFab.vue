<template>
  <SfFab
    :visible="cart.count > 0"
    :count="cart.count"
    label="Корзина"
    :price="`${cart.subtotal} ${currency}`"
    @click="emit('click')"
  >
    <template #icon>
      <ShoppingCart :size="24" />
    </template>
  </SfFab>
</template>

<script setup lang="ts">
import { ShoppingCart } from 'lucide-vue-next'
import { useCartStore } from '~/stores/cart'
import { useCurrency } from '~/composables/useCurrency'
import SfFab from '~/components/sf/domain/SfFab.vue'

const emit = defineEmits<{ click: [] }>()
const cart = useCartStore()
const currency = useCurrency()
</script>
