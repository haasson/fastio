import type { OrderItem } from '../types/order'
import type { DishModifierGroup } from '../types/modifier'

export type MenuDish = {
  id: string
  name: string
  price: number
  photos: string[]
  ingredients: { name: string }[]
}

export type MenuCombo = {
  id: string
  name: string
  price: number
  photos: string[]
}

export type MenuAddon = {
  id: string
  name: string
  price: number
  weight: number | null
  order: number
}

// `_key` — UUID конкретной строки в корзине (две одинаковые позиции с разными
// модификаторами различаются именно по нему). Reconciler ОБЯЗАН пробросить его
// в выход без изменений: `cart.patchByKey(...)` ищет совпадения по `_key`,
// и потеря его в reconciler'е стирает корзину пользователя. Контракт явный —
// чтобы рефактор без spread не сломал это незаметно.
export type ReconcileCartItem = OrderItem & { photo: string | null; _key: string }

export type ReconcileServiceItem = {
  _key: string
  serviceId: string
  serviceName: string
  price: number
  duration: number
  photo: string | null
  preferredResourceId: string | null
  allowResourceChoice: boolean
  branchId: string | null
}

export type ReconcileService = {
  id: string
  name: string
  price: number
  duration: number
  photos: string[]
  isBookable: boolean
  allowResourceChoice: boolean
}

export type ServiceRemovalReason = 'service_missing' | 'service_not_bookable'

export type RemovedServiceItem = {
  item: ReconcileServiceItem
  reason: ServiceRemovalReason
}

export type ReconcileServiceResult = {
  items: ReconcileServiceItem[]
  removed: RemovedServiceItem[]
  updated: ReconcileServiceItem[]
}

// Реконсиляция services. Симметрично reconcileCart, но проще: только
// проверяем что serviceId всё ещё в каталоге и обновляем
// name/price/duration/photo если расходятся со снапшотом.
export function reconcileServices(
  cartItems: ReconcileServiceItem[],
  services: ReconcileService[],
): ReconcileServiceResult {
  const items: ReconcileServiceItem[] = []
  const removed: RemovedServiceItem[] = []
  const updated: ReconcileServiceItem[] = []

  const serviceMap = new Map(services.map((s) => [s.id, s]))

  for (const item of cartItems) {
    const svc = serviceMap.get(item.serviceId)
    if (!svc) {
      removed.push({ item, reason: 'service_missing' })
      continue
    }
    if (!svc.isBookable) {
      removed.push({ item, reason: 'service_not_bookable' })
      continue
    }

    const newPhoto = svc.photos[0] ?? null
    const newPreferredResourceId = svc.allowResourceChoice ? item.preferredResourceId : null
    const changed
      = svc.name !== item.serviceName
      || svc.price !== item.price
      || svc.duration !== item.duration
      || newPhoto !== item.photo
      || newPreferredResourceId !== item.preferredResourceId

    const next: ReconcileServiceItem = {
      ...item,
      serviceName: svc.name,
      price: svc.price,
      duration: svc.duration,
      photo: newPhoto,
      allowResourceChoice: svc.allowResourceChoice,
      preferredResourceId: newPreferredResourceId,
    }

    items.push(next)
    if (changed) updated.push(next)
  }

  return { items, removed, updated }
}

export type ReconcileMenuData = {
  dishes: MenuDish[]
  combos: MenuCombo[]
  dishModifiers: Record<string, DishModifierGroup[]>
  dishAddons: Record<string, MenuAddon[]>
}

export type RemovalReason = 'dish_missing' | 'combo_missing' | 'modifier_invalid' | 'addon_invalid'

export type RemovedItem = {
  item: ReconcileCartItem
  reason: RemovalReason
}

export type ReconcileResult = {
  items: ReconcileCartItem[]
  removed: RemovedItem[]
  updated: ReconcileCartItem[]
}

export function reconcileCart(
  cartItems: ReconcileCartItem[],
  menu: ReconcileMenuData,
): ReconcileResult {
  const items: ReconcileCartItem[] = []
  const removed: RemovedItem[] = []
  const updated: ReconcileCartItem[] = []

  const dishMap = new Map(menu.dishes.map(d => [d.id, d]))
  const comboMap = new Map(menu.combos.map(c => [c.id, c]))

  for (const item of cartItems) {
    // Combo items — validate combo exists in menu
    if (item.comboId) {
      const combo = comboMap.get(item.comboId)
      if (!combo) {
        removed.push({ item, reason: 'combo_missing' })
        continue
      }

      let priceChanged = false
      if (combo.price !== item.price) priceChanged = true

      const updatedItem: ReconcileCartItem = {
        ...item,
        dishName: combo.name,
        photo: combo.photos[0] ?? null,
        price: combo.price,
      }

      items.push(updatedItem)
      if (priceChanged) updated.push(updatedItem)
      continue
    }

    // 1. Check dish exists in menu
    const dish = item.dishId ? dishMap.get(item.dishId) : null
    if (!dish) {
      removed.push({ item, reason: 'dish_missing' })
      continue
    }

    // 2. Validate modifiers — if any optionId is missing from dish modifiers, remove item
    const dishModGroups = menu.dishModifiers[item.dishId!] ?? []
    const allOptionIds = new Set(
      dishModGroups.flatMap(g => g.options.map(o => o.optionId)),
    )

    const hasInvalidModifier = item.modifiers.some(
      m => m.optionId && !allOptionIds.has(m.optionId),
    )
    if (hasInvalidModifier) {
      removed.push({ item, reason: 'modifier_invalid' })
      continue
    }

    // 3. Validate addons — if any addonId is missing from dish addons, remove item
    const dishAddonList = menu.dishAddons[item.dishId!] ?? []
    const allAddonIds = new Set(dishAddonList.map(a => a.id))

    const hasInvalidAddon = item.addons.some(a => !allAddonIds.has(a.addonId))
    if (hasInvalidAddon) {
      removed.push({ item, reason: 'addon_invalid' })
      continue
    }

    // Build option lookup for price/name updates
    const optionMap = new Map(
      dishModGroups.flatMap(g =>
        g.options.map(o => [o.optionId, { ...o, groupName: g.groupName }]),
      ),
    )
    const addonMap = new Map(dishAddonList.map(a => [a.id, a]))

    // Track if any price changed
    let priceChanged = false

    // 4 & 5. Update prices and cosmetic fields
    const newPrice = dish.price
    if (newPrice !== item.price) priceChanged = true

    const newModifiers = item.modifiers.map(m => {
      if (!m.optionId) return m
      const opt = optionMap.get(m.optionId)
      if (!opt) return m
      if (opt.priceDelta !== m.priceDelta) priceChanged = true
      return {
        optionId: m.optionId,
        groupName: opt.groupName,
        optionName: opt.optionName,
        priceDelta: opt.priceDelta,
      }
    })

    const newAddons = item.addons.map(a => {
      const addon = addonMap.get(a.addonId)
      if (!addon) return a
      if (addon.price !== a.price) priceChanged = true
      return {
        addonId: a.addonId,
        addonName: addon.name,
        price: addon.price,
      }
    })

    // 6. Filter removedIngredients — keep only those still in dish ingredients
    const ingredientNames = new Set(dish.ingredients.map(i => i.name))
    const newRemovedIngredients = item.removedIngredients.filter(name =>
      ingredientNames.has(name),
    )

    const updatedItem: ReconcileCartItem = {
      ...item,
      dishName: dish.name,
      photo: dish.photos[0] ?? null,
      price: newPrice,
      modifiers: newModifiers,
      addons: newAddons,
      removedIngredients: newRemovedIngredients,
    }

    items.push(updatedItem)
    if (priceChanged) {
      updated.push(updatedItem)
    }
  }

  return { items, removed, updated }
}
