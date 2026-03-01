import { defineStore, skipHydrate } from 'pinia'
import type { OrderItem } from '@fastfood-saas/shared'

export type CartItem = OrderItem & { photo: string | null }

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const count = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))
  const subtotal = computed(() => items.value.reduce((s, i) => s + i.price * i.quantity, 0))

  function add(item: CartItem) {
    const existing = items.value.find(
      (i) =>
        i.dishId === item.dishId &&
        JSON.stringify(i.removedIngredients) === JSON.stringify(item.removedIngredients),
    )
    if (existing) {
      existing.quantity += item.quantity
    } else {
      items.value.push({ ...item })
    }
    persist()
  }

  function increment(index: number) {
    items.value[index].quantity++
    persist()
  }

  function decrement(index: number) {
    if (items.value[index].quantity > 1) {
      items.value[index].quantity--
    } else {
      items.value.splice(index, 1)
    }
    persist()
  }

  function remove(index: number) {
    items.value.splice(index, 1)
    persist()
  }

  function clear() {
    items.value = []
    persist()
  }

  function persist() {
    if (import.meta.client) {
      localStorage.setItem('cart', JSON.stringify(items.value))
    }
  }

  function restore() {
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem('cart')
        if (raw) items.value = JSON.parse(raw)
      } catch {
        items.value = []
      }
    }
  }

  return { items, count: skipHydrate(count), subtotal: skipHydrate(subtotal), add, increment, decrement, remove, clear, restore }
})
