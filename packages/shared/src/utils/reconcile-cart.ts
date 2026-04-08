import type { OrderItem } from '../types/order'
import type { DishModifierGroup } from '../types/modifier'

export type MenuDish = {
  id: string
  name: string
  price: number
  photos: string[]
  ingredients: { name: string }[]
}

export type MenuAddon = {
  id: string
  name: string
  price: number
  weight: number | null
  order: number
}

export type ReconcileCartItem = OrderItem & { photo: string | null }

export type ReconcileMenuData = {
  dishes: MenuDish[]
  dishModifiers: Record<string, DishModifierGroup[]>
  dishAddons: Record<string, MenuAddon[]>
}

export type ReconcileResult = {
  items: ReconcileCartItem[]
  removed: ReconcileCartItem[]
  updated: ReconcileCartItem[]
}

export function reconcileCart(
  cartItems: ReconcileCartItem[],
  menu: ReconcileMenuData,
): ReconcileResult {
  const items: ReconcileCartItem[] = []
  const removed: ReconcileCartItem[] = []
  const updated: ReconcileCartItem[] = []

  const dishMap = new Map(menu.dishes.map(d => [d.id, d]))

  for (const item of cartItems) {
    // Skip combo items — pass through unchanged
    if (item.comboId) {
      items.push(item)
      continue
    }

    // 1. Check dish exists in menu
    const dish = item.dishId ? dishMap.get(item.dishId) : null
    if (!dish) {
      removed.push(item)
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
      removed.push(item)
      continue
    }

    // 3. Validate addons — if any addonId is missing from dish addons, remove item
    const dishAddonList = menu.dishAddons[item.dishId!] ?? []
    const allAddonIds = new Set(dishAddonList.map(a => a.id))

    const hasInvalidAddon = item.addons.some(a => !allAddonIds.has(a.addonId))
    if (hasInvalidAddon) {
      removed.push(item)
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
