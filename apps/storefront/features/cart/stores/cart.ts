import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { z } from 'zod'
import type { OrderItem } from '@fastio/shared'
import { getItemUnitPrice } from '@fastio/shared'
import { reportError } from '~/shared/utils/reportError'

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
  /** Филиал, в котором добавлена услуга. null = не привязана к филиалу (global / unified без выбора). */
  branchId: string | null
}

export type CartItem = DishCartItem | ServiceCartItem

// Type guards для discriminated union — не дублировать `i.kind === 'dish'` по компонентам.
export const isDishItem = (i: CartItem): i is DishCartItem => i.kind === 'dish'
export const isServiceItem = (i: CartItem): i is ServiceCartItem => i.kind === 'service'

// PREPROD-227: zod-валидация при restore. Битый item в localStorage не должен
// рассыпать всю корзину — schema'и используются с safeParse + flatMap,
// каждый невалидный элемент логируется в Sentry и отбрасывается.
const OrderItemModifierSchema = z.object({
  optionId: z.string().optional(),
  groupName: z.string(),
  optionName: z.string(),
  priceDelta: z.number(),
}).passthrough()

const OrderItemAddonSchema = z.object({
  addonId: z.string(),
  addonName: z.string(),
  price: z.number(),
}).passthrough()

// Толерантная "nullable + default null": legacy-записи могут не иметь поля вовсе.
const nullish = <T extends z.ZodTypeAny>(schema: T) => schema.nullish().transform((v) => v ?? null)

const DishCartItemSchema = z.object({
  kind: z.literal('dish'),
  _key: z.string().min(1),
  dishId: nullish(z.string()),
  comboId: nullish(z.string()),
  dishName: z.string(),
  categoryName: nullish(z.string()),
  price: z.number(),
  quantity: z.number().int().positive(),
  removedIngredients: z.array(z.string()).default([]),
  modifiers: z.array(OrderItemModifierSchema).default([]),
  addons: z.array(OrderItemAddonSchema).default([]),
  photo: nullish(z.string()),
  completedAt: nullish(z.string()),
  comboItems: nullish(z.array(z.object({ dishName: z.string() }).passthrough())),
  addedBy: nullish(z.string()),
  confirmedBy: nullish(z.string()),
  status: z.enum(['pending', 'confirmed']).default('pending'),
}).passthrough()

const ServiceCartItemSchema = z.object({
  kind: z.literal('service'),
  _key: z.string().min(1),
  serviceId: z.string(),
  serviceName: z.string(),
  price: z.number(),
  duration: z.number(),
  photo: nullish(z.string()),
  preferredResourceId: nullish(z.string()),
  allowResourceChoice: z.boolean(),
  branchId: nullish(z.string()),
}).passthrough()

// PREPROD-264: ключ localStorage с префиксом по slug тенанта — иначе в dev-режиме
// `?slug=X` корзины разных тенантов сливаются в один и тот же ключ `cart`.
// Slug берём из hostname (как server/middleware/tenant.ts: первая часть домена),
// с override из ?slug= для dev-fallback. На SSR localStorage недоступен в принципе.
const LEGACY_CART_KEY = 'cart'
const CART_KEY_PREFIX = 'cart:'

function getTenantSlug(): string {
  if (typeof window === 'undefined') return 'unknown'
  try {
    const url = new URL(window.location.href)
    const querySlug = url.searchParams.get('slug')
    if (querySlug) return querySlug
    const host = url.hostname
    if (!host) return 'unknown'
    return host.split(':')[0].split('.')[0] || 'unknown'
  } catch {
    return 'unknown'
  }
}

function getCartStorageKey(): string {
  return `${CART_KEY_PREFIX}${getTenantSlug()}`
}

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
        localStorage.setItem(getCartStorageKey(), JSON.stringify(items.value))
      } catch (e) {
        reportError(e instanceof Error ? e : new Error('[cart.persist] failed to write to localStorage'), {
          context: 'cart-persist',
        })
      }
    }
  }

  // Нормализация одного item из localStorage в CartItem. Прогоняет через zod;
  // невалидные элементы возвращают пустой массив и логируются в Sentry.
  // Legacy-записи без `kind` (до services-в-корзине) ремаппятся в `dish`.
  function normalizeRawItem(raw: unknown): CartItem[] {
    if (typeof raw !== 'object' || raw === null) {
      reportError(new Error('[cart.restore] item is not an object'), {
        context: 'cart-restore',
        raw: typeof raw,
      })
      return []
    }
    const obj = raw as Record<string, unknown>

    // Legacy: до выкатки services-в-корзину записи не имели kind. Маппим в dish,
    // чтобы корзины пользователей пережили деплой.
    if (!('kind' in obj) || obj.kind === undefined) {
      const candidate = {
        ...obj,
        kind: 'dish' as const,
        modifiers: Array.isArray(obj.modifiers) ? obj.modifiers : [],
        addons: Array.isArray(obj.addons) ? obj.addons : [],
        removedIngredients: Array.isArray(obj.removedIngredients) ? obj.removedIngredients : [],
        _key: typeof obj._key === 'string' && obj._key ? obj._key : crypto.randomUUID(),
      }
      const result = DishCartItemSchema.safeParse(candidate)
      if (!result.success) {
        reportError(new Error('[cart.restore] legacy dish item failed validation'), {
          context: 'cart-restore',
          // Только path/code/message — без issue.input, чтобы не лить значения юзера в Sentry.
        issues: result.error.issues.map((i) => ({ path: i.path, code: i.code, message: i.message })),
        })
        return []
      }
      return [result.data as DishCartItem]
    }

    // Заранее отбрасываем item'ы с неизвестным kind (null/undefined/строка-мусор),
    // чтобы не плодить шум в Sentry — это «нормальная» порча для discriminated union.
    if (obj.kind !== 'dish' && obj.kind !== 'service') {
      return []
    }

    if (obj.kind === 'dish') {
      const candidate = {
        ...obj,
        modifiers: Array.isArray(obj.modifiers) ? obj.modifiers : [],
        addons: Array.isArray(obj.addons) ? obj.addons : [],
        removedIngredients: Array.isArray(obj.removedIngredients) ? obj.removedIngredients : [],
        _key: typeof obj._key === 'string' && obj._key ? obj._key : crypto.randomUUID(),
      }
      const result = DishCartItemSchema.safeParse(candidate)
      if (!result.success) {
        reportError(new Error('[cart.restore] dish item failed validation'), {
          context: 'cart-restore',
          // Только path/code/message — без issue.input, чтобы не лить значения юзера в Sentry.
        issues: result.error.issues.map((i) => ({ path: i.path, code: i.code, message: i.message })),
        })
        return []
      }
      return [result.data as DishCartItem]
    }

    const candidate = {
      ...obj,
      branchId: obj.branchId ?? null,
      _key: typeof obj._key === 'string' && obj._key ? obj._key : crypto.randomUUID(),
    }
    const result = ServiceCartItemSchema.safeParse(candidate)
    if (!result.success) {
      reportError(new Error('[cart.restore] service item failed validation'), {
        context: 'cart-restore',
        // Только path/code/message — без issue.input, чтобы не лить значения юзера в Sentry.
        issues: result.error.issues.map((i) => ({ path: i.path, code: i.code, message: i.message })),
      })
      return []
    }
    return [result.data as ServiceCartItem]
  }

  function restore() {
    if (typeof window === 'undefined') return
    try {
      const key = getCartStorageKey()
      // PREPROD-264: одноразовая миграция legacy-ключа `cart` → `cart:<slug>`.
      // Если оба ключа существуют (например, юзер заходил на разные slug'и),
      // приоритет у нового — legacy просто удаляем.
      let raw = localStorage.getItem(key)
      const legacyRaw = localStorage.getItem(LEGACY_CART_KEY)
      if (legacyRaw !== null) {
        if (raw === null) {
          // Переносим legacy → новый ключ. Делаем setItem ДО parse, чтобы
          // даже если содержимое битое, юзер не получил миграцию повторно
          // при следующем restore (legacy будет удалён).
          try {
            localStorage.setItem(key, legacyRaw)
          } catch (e) {
            reportError(e instanceof Error ? e : new Error('[cart.restore] legacy migration write failed'), {
              context: 'cart-restore',
            })
          }
          raw = legacyRaw
        }
        try {
          localStorage.removeItem(LEGACY_CART_KEY)
        } catch (e) {
          reportError(e instanceof Error ? e : new Error('[cart.restore] legacy cleanup failed'), {
            context: 'cart-restore',
          })
        }
      }
      if (!raw) return
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (e) {
        // PREPROD-233: тихий fail при битом JSON — отправляем в Sentry,
        // оставляем пустую корзину.
        reportError(e instanceof Error ? e : new Error('[cart.restore] failed to parse cart from localStorage'), {
          context: 'cart-restore',
        })
        items.value = []
        return
      }
      if (!Array.isArray(parsed)) {
        reportError(new Error('[cart.restore] localStorage payload is not an array'), {
          context: 'cart-restore',
          actualType: typeof parsed,
        })
        items.value = []
        return
      }
      items.value = parsed.flatMap(normalizeRawItem)
    } catch (e) {
      reportError(e instanceof Error ? e : new Error('[cart.restore] unexpected restore failure'), {
        context: 'cart-restore',
      })
      items.value = []
    } finally {
      restored.value = true
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
