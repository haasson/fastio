import { computed } from 'vue'
import type { KitchenQueueItem } from '@fastio/shared'
import { orderItemKey } from '@fastio/shared'
import type { TableSession } from '~/utils/api/tables'

export type KitchenProgressRow = {
  key: string
  ids: string[]
  dishName: string
  count: number
  dotClass: string
  unitPrice: number
  totalPrice: number
  status: 'queued' | 'in_progress' | 'done'
}

export default function useKitchenProgress(
  getKitchenDishes: () => KitchenQueueItem[] | undefined,
  getSession: () => TableSession | undefined,
  options?: { includeDone?: boolean },
) {
  const kitchenProgress = computed<KitchenProgressRow[]>(() => {
    const kitchenDishes = getKitchenDishes()

    if (!kitchenDishes?.length) return []

    const allowedStatuses = options?.includeDone
      ? ['queued', 'in_progress', 'done']
      : ['queued', 'in_progress']

    // Build price lookup keyed by dishName + customization fingerprint
    const priceMap = new Map<string, number>()

    for (const item of getSession()?.items ?? []) {
      const fp = orderItemKey(item.modifiers, item.addons, item.removedIngredients)

      priceMap.set(`${item.dishName}::${fp}`, item.price)
    }

    const map = new Map<string, KitchenProgressRow>()

    for (const item of kitchenDishes) {
      if (!allowedStatuses.includes(item.status)) continue

      const fp = orderItemKey(item.modifiers, item.addons, item.removedIngredients)
      const key = `${item.dishName}::${fp}::${item.status}`
      let row = map.get(key)

      if (!row) {
        row = {
          key,
          ids: [],
          dishName: item.dishName,
          count: 0,
          dotClass: item.status === 'in_progress'
            ? 'dot--cooking'
            : item.status === 'done'
              ? 'dot--ready'
              : 'dot--queued',
          unitPrice: priceMap.get(`${item.dishName}::${fp}`) ?? 0,
          totalPrice: 0,
          status: item.status as 'queued' | 'in_progress' | 'done',
        }
        map.set(key, row)
      }

      row.ids.push(item.id)
      row.count++
      row.totalPrice = row.count * row.unitPrice
    }

    return [...map.values()]
  })

  return { kitchenProgress }
}
