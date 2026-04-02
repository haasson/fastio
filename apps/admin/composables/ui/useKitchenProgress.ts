import { computed } from 'vue'
import type { KitchenQueueItem } from '@fastio/shared'
import { orderItemKey } from '@fastio/shared'
import type { TableSession } from '~/utils/api/tables'

export type KitchenProgressRow = {
  key: string
  dishName: string
  count: number
  dotClass: string
  totalPrice: number
}

export default function useKitchenProgress(
  getKitchenDishes: () => KitchenQueueItem[] | undefined,
  getSession: () => TableSession | undefined,
) {
  const kitchenProgress = computed<KitchenProgressRow[]>(() => {
    const kitchenDishes = getKitchenDishes()

    if (!kitchenDishes?.length) return []

    // Build price lookup keyed by dishName + customization fingerprint
    const priceMap = new Map<string, number>()

    for (const item of getSession()?.items ?? []) {
      const fp = orderItemKey(item.modifiers, item.addons, item.removedIngredients)

      priceMap.set(`${item.dishName}::${fp}`, item.price)
    }

    const map = new Map<string, KitchenProgressRow>()

    for (const item of kitchenDishes) {
      if (item.status !== 'queued' && item.status !== 'in_progress') continue

      const fp = orderItemKey(item.modifiers, item.addons, item.removedIngredients)
      const key = `${item.dishName}::${fp}::${item.status}`
      let row = map.get(key)

      if (!row) {
        row = {
          key,
          dishName: item.dishName,
          count: 0,
          dotClass: item.status === 'in_progress' ? 'dot--cooking' : 'dot--queued',
          totalPrice: 0,
        }
        map.set(key, row)
      }

      row.count++
      row.totalPrice = row.count * (priceMap.get(`${item.dishName}::${fp}`) ?? 0)
    }

    return [...map.values()]
  })

  return { kitchenProgress }
}
