import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { OrderItem } from '@fastio/shared'
import { getItemUnitPrice } from '@fastio/shared'
import { reportError } from '~/utils/reportError'

export type DishCartItem = OrderItem & {
  kind: 'dish'
  photo: string | null
  _key: string
}

export type ServiceCartItem = {
  kind: 'service'
  _key: string
  serviceId: string
  serviceName: string
  price: number
  duration: number
  photo: string | null
  preferredResourceId: string | null
  allowResourceChoice: boolean
}

export type CartItem = DishCartItem | ServiceCartItem

// Type guards для discriminated union — не дублировать `i.kind === 'dish'` по компонентам.
export const isDishItem = (i: CartItem): i is DishCartItem => i.kind === 'dish'
export const isServiceItem = (i: CartItem): i is ServiceCartItem => i.kind === 'service'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const restored = ref(false)

  const dishItems = computed(() => items.value.filter(isDishItem))
  const serviceItems = computed(() => items.value.filter(isServiceItem))

  const dishCount = computed(() => dishItems.value.reduce((s, i) => s + i.quantity, 0))
  const serviceCount = computed(() => serviceItems.value.length)
  const count = computed(() => dishCount.value + serviceCount.value)

  const dishSubtotal = computed(() =>
    dishItems.value.reduce((s, i) => s + getItemUnitPrice(i) * i.quantity, 0),
  )
  const serviceSubtotal = computed(() =>
    serviceItems.value.reduce((s, i) => s + i.price, 0),
  )
  const subtotal = computed(() => dishSubtotal.value + serviceSubtotal.value)
  const totalServiceDuration = computed(() =>
    serviceItems.value.reduce((s, i) => s + i.duration, 0),
  )

  function add(item: CartItem) {
    // Гард: на slow 3G `add()` может срабатывать до завершения `restore()` —
    // новые элементы перезатрутся восстановлением из localStorage.
    if (!restored.value) return
    if (item.kind === 'dish') {
      const existing = items.value.find(
        (i): i is DishCartItem =>
          i.kind === 'dish' &&
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
    } else {
      // services уникальны по serviceId — повторный add() это no-op; UI должен сам проверять
      // inCart до вызова, иначе пользователь не увидит фидбека
      const exists = items.value.some(
        (i) => i.kind === 'service' && i.serviceId === item.serviceId,
      )
      if (!exists) {
        items.value.push({ ...item, _key: crypto.randomUUID() })
      }
    }
    persist()
  }

  function increment(index: number) {
    if (!restored.value) return
    const target = items.value[index]
    if (target?.kind !== 'dish') return
    target.quantity++
    persist()
  }

  function decrement(index: number) {
    if (!restored.value) return
    const target = items.value[index]
    if (target?.kind !== 'dish') return
    if (target.quantity > 1) {
      target.quantity--
    } else {
      items.value.splice(index, 1)
    }
    persist()
  }

  function remove(index: number) {
    if (!restored.value) return
    items.value.splice(index, 1)
    persist()
  }

  function replace(index: number, item: CartItem) {
    if (!restored.value) return
    const current = items.value[index]
    if (!current) return
    if (current.kind !== item.kind) {
      reportError(
        new Error(
          `[cart.replace] kind mismatch: current=${current.kind} next=${item.kind}`,
        ),
      )
      return
    }
    items.value[index] = { ...item, _key: current._key } as CartItem
    persist()
  }

  function setQuantity(index: number, quantity: number) {
    if (!restored.value) return
    const target = items.value[index]
    if (target?.kind !== 'dish') return
    if (quantity <= 0) {
      items.value.splice(index, 1)
    } else {
      target.quantity = quantity
    }
    persist()
  }

  function replaceAll(newItems: CartItem[]) {
    if (!restored.value) return
    items.value = newItems
    persist()
  }

  // Обновление списка по `_key` без сброса индексов уже существующих позиций —
  // важно для открытых модалок useCartEdit, которые адресуют item по `_key`.
  // Семантика: items, чьи `_key` есть в `newItems`, обновляются in-place;
  // отсутствующие в newItems — удаляются; новые — добавляются в конец.
  function patchByKey(newItems: CartItem[]) {
    if (!restored.value) return
    const incomingByKey = new Map(newItems.map((i) => [i._key, i]))
    const kept: CartItem[] = []
    for (const cur of items.value) {
      const incoming = incomingByKey.get(cur._key)
      if (!incoming) continue
      if (cur.kind === incoming.kind) {
        kept.push({ ...cur, ...incoming } as CartItem)
      } else {
        kept.push(incoming)
      }
      incomingByKey.delete(cur._key)
    }
    for (const incoming of incomingByKey.values()) {
      kept.push(incoming)
    }
    items.value = kept
    persist()
  }

  function removeService(serviceId: string) {
    if (!restored.value) return
    items.value = items.value.filter(
      (i) => !(i.kind === 'service' && i.serviceId === serviceId),
    )
    persist()
  }

  function setPreferredResource(serviceId: string, resourceId: string | null): boolean {
    if (!restored.value) return false
    let matched = false
    items.value = items.value.map((i) => {
      if (i.kind === 'service' && i.serviceId === serviceId) {
        matched = true
        return { ...i, preferredResourceId: resourceId }
      }
      return i
    })
    if (matched) persist()
    return matched
  }

  function clear() {
    if (!restored.value) return
    items.value = []
    persist()
  }

  // Возвращает функцию, которую нужно вызвать ПОСЛЕ `await` — удаляет ровно те
  // dish-позиции, что были в корзине на момент snapshot'a. Защита от того, что
  // `clearDishes` вызывался после `await $fetch` и стирал позиции,
  // добавленные за время запроса.
  function clearDishes() {
    if (!restored.value) return () => {}
    const snapshotKeys = new Set(items.value.filter(isDishItem).map((i) => i._key))
    return () => {
      if (!restored.value) return
      items.value = items.value.filter((i) => !snapshotKeys.has(i._key))
      persist()
    }
  }

  function clearServices() {
    if (!restored.value) return () => {}
    const snapshotKeys = new Set(items.value.filter(isServiceItem).map((i) => i._key))
    return () => {
      if (!restored.value) return
      items.value = items.value.filter((i) => !snapshotKeys.has(i._key))
      persist()
    }
  }

  function persist() {
    if (typeof window !== 'undefined') {
      // QuotaExceededError, Safari Private mode, отозванный доступ — не должны
      // ронять корзинную операцию. In-memory state всё равно консистентен.
      try {
        localStorage.setItem('cart', JSON.stringify(items.value))
      } catch (e) {
        reportError(e instanceof Error ? e : new Error('[cart.persist] failed to write to localStorage'))
      }
    }
  }

  function restore() {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('cart')
        if (raw) {
          const parsed = JSON.parse(raw) as Array<Partial<CartItem>>
          items.value = parsed.flatMap((item): CartItem[] => {
            // Сохранённые до выкатки services-в-корзину записи не имеют kind —
            // мапим в dish, чтобы корзины пользователей пережили деплой.
            // Дефолты для addons/removedIngredients обязательны: иначе reconcile упадёт
            // `Cannot read 'some' of undefined`.
            if (!('kind' in item) || item.kind === undefined) {
              const dishItem = item as Partial<DishCartItem>
              return [{
                ...(dishItem as DishCartItem),
                kind: 'dish' as const,
                modifiers: dishItem.modifiers ?? [],
                addons: dishItem.addons ?? [],
                removedIngredients: dishItem.removedIngredients ?? [],
                _key: dishItem._key || crypto.randomUUID(),
              }]
            }
            // Валидация kind: skip кривых элементов (null/undefined/строка-мусор)
            if (item.kind !== 'dish' && item.kind !== 'service') return []
            if (item.kind === 'dish') {
              const dishItem = item as Partial<DishCartItem>
              return [{
                ...(dishItem as DishCartItem),
                kind: 'dish' as const,
                modifiers: dishItem.modifiers ?? [],
                addons: dishItem.addons ?? [],
                removedIngredients: dishItem.removedIngredients ?? [],
                _key: dishItem._key || crypto.randomUUID(),
              }]
            }
            return [{ ...(item as ServiceCartItem), _key: item._key || crypto.randomUUID() }]
          })
        }
      } catch (e) {
        reportError(e instanceof Error ? e : new Error('[cart.restore] failed to parse cart from localStorage'))
        items.value = []
      } finally {
        restored.value = true
      }
    }
  }

  return {
    items,
    dishItems,
    serviceItems,
    count,
    dishCount,
    serviceCount,
    subtotal,
    dishSubtotal,
    serviceSubtotal,
    totalServiceDuration,
    restored,
    add,
    increment,
    decrement,
    remove,
    replace,
    replaceAll,
    patchByKey,
    setQuantity,
    removeService,
    setPreferredResource,
    clear,
    clearDishes,
    clearServices,
    restore,
  }
})
