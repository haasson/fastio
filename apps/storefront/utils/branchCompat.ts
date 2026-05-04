import type { Dish } from '@fastio/shared'
import type { DishCartItem } from '~/stores/cart'

export type BranchStatus = 'green' | 'yellow' | 'red'

export type BranchCompat = {
  id: string
  name: string
  status: BranchStatus
  missingNames: string[]
}

export type BranchInfo = { id: string; name: string }

/**
 * Совместимость dish-позиций корзины с каждым филиалом.
 * - green: все позиции доступны
 * - yellow: есть и доступные, и недоступные
 * - red: ничего из корзины не выполнят
 *
 * Чистая функция — без Pinia/Nuxt, легко юнит-тестируется и переиспользуется
 * в CartBranchStatus, CheckoutPickupBranch и при необходимости в header switcher.
 *
 * Семантика branchIds:
 * - пустой массив = «во всех филиалах» (как ServiceWithBranchIds)
 * - длина равная totalBranchCount = тоже «во всех филиалах»
 *   (селектор просто перечислил всех)
 */
export function computeBranchCompat(
  dishItems: DishCartItem[],
  dishesById: Map<string, Dish>,
  branches: BranchInfo[],
  totalBranchCount: number,
): BranchCompat[] {
  return branches.map((b): BranchCompat => {
    if (dishItems.length === 0) {
      return { id: b.id, name: b.name, status: 'green', missingNames: [] }
    }

    let availableCount = 0
    const missingNames: string[] = []

    for (const item of dishItems) {
      if (!item.dishId) continue
      const dish = dishesById.get(item.dishId)
      if (!dish) continue // блюдо неизвестно (возможно реконсилятор ещё не отработал) — пропускаем
      const isAvailable
        = dish.branchIds.length === 0
        || dish.branchIds.length >= totalBranchCount
        || dish.branchIds.includes(b.id)
      if (isAvailable) availableCount++
      else missingNames.push(dish.name)
    }

    if (availableCount === 0) return { id: b.id, name: b.name, status: 'red', missingNames }
    if (missingNames.length === 0) return { id: b.id, name: b.name, status: 'green', missingNames: [] }
    return { id: b.id, name: b.name, status: 'yellow', missingNames }
  })
}

/**
 * Имена блюд из корзины, которые отсутствуют в указанном филиале.
 * Тонкая обёртка над computeBranchCompat для случая «проверить один филиал».
 */
export function getMissingBranchDishNames(
  dishItems: DishCartItem[],
  dishesById: Map<string, Dish>,
  branchId: string,
  totalBranchCount: number,
): string[] {
  const [result] = computeBranchCompat(
    dishItems,
    dishesById,
    [{ id: branchId, name: '' }],
    totalBranchCount,
  )
  return result?.missingNames ?? []
}
