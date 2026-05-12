import { defineNuxtPlugin, onNuxtReady } from 'nuxt/app'
import { useCartStore } from '~/features/cart'

export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    const cart = useCartStore()
    cart.restore()
  })
})
