import { defineNuxtPlugin } from 'nuxt/app'
import { useCartStore } from '~/stores/cart'

export default defineNuxtPlugin(() => {
  const cart = useCartStore()
  cart.restore()
})
