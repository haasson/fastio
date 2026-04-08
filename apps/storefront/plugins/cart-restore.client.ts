import { defineNuxtPlugin, onNuxtReady } from 'nuxt/app'
import { useCartStore } from '~/stores/cart'

export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    const cart = useCartStore()
    cart.restore()
  })
})
