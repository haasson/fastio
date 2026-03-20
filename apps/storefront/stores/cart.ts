import { defineStore } from 'pinia'
import type { OrderItem } from '@fastio/shared'
import { getItemUnitPrice } from '@fastio/shared'

export type CartItem = OrderItem & { photo: string | null; _key?: string }

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const restored = ref(false)

  const count = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))
  const subtotal = computed(() =>
    items.value.reduce((s, i) => s + getItemUnitPrice(i) * i.quantity, 0),
  )

  function add(item: CartItem) {
    const existing = items.value.find(
      (i) =>
        i.dishId === item.dishId &&
        JSON.stringify(i.removedIngredients) === JSON.stringify(item.removedIngredients) &&
        JSON.stringify(i.modifiers ?? []) === JSON.stringify(item.modifiers ?? []) &&
        JSON.stringify(i.addons ?? []) === JSON.stringify(item.addons ?? []),
    )
    if (existing) {
      existing.quantity += item.quantity
    } else {
      items.value.push({ ...item, _key: crypto.randomUUID() })
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

  function replace(index: number, item: CartItem) {
    items.value[index] = { ...item, _key: items.value[index]._key }
    persist()
  }

  function setQuantity(index: number, quantity: number) {
    if (quantity <= 0) {
      items.value.splice(index, 1)
    } else {
      items.value[index].quantity = quantity
    }
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
        if (raw) {
          items.value = (JSON.parse(raw) as CartItem[]).map((item) => ({
            ...item,
            modifiers: item.modifiers ?? [],
            _key: item._key ?? crypto.randomUUID(),
          }))
        }
      } catch {
        items.value = []
      } finally {
        restored.value = true
      }
    }
  }

  return { items, count, subtotal, restored, add, increment, decrement, remove, replace, setQuantity, clear, restore }
})
