import { computed } from 'vue'
import type { KitchenQueueItem } from '@fastio/shared'
import { orderItemKey } from '@fastio/shared'
import type { TableSession } from '~/features/tables'

type RowStatus = 'queued' | 'in_progress' | 'done'

export type KitchenProgressChild = {
  dishName: string
  total: number
  readyCount: number
  status: RowStatus
}

export type KitchenProgressRow = {
  key: string
  ids: string[]
  dishName: string
  count: number
  dotClass: string
  unitPrice: number
  totalPrice: number
  status: RowStatus
  // Комбо — атомарная единица на столе: блюда внутри развёрнуты только для кухни,
  // здесь схлопнуты в одну строку по orderItemId. Для обычных блюд isCombo=false и
  // combo-поля нейтральны (UI гейтит по isCombo).
  isCombo: boolean
  comboName: string | null
  orderItemId: string | null
  readyCount: number
  total: number
  children: KitchenProgressChild[]
}

const dotFor = (status: RowStatus): string => status === 'in_progress'
  ? 'dot--cooking'
  : status === 'done'
    ? 'dot--ready'
    : 'dot--queued'

type ChildAccum = { dishName: string; total: number; readyCount: number; hasInProgress: boolean }

export function useKitchenProgress(
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

    // Price lookup keyed by dishName + customization fingerprint. Для комбо триггер
    // пишет combo_name = dish_name позиции, поэтому цену комбо тянем по comboName.
    const priceMap = new Map<string, number>()

    for (const item of getSession()?.items ?? []) {
      const fp = orderItemKey(item.modifiers, item.addons, item.removedIngredients)

      priceMap.set(`${item.dishName}::${fp}`, item.price)
    }

    const map = new Map<string, KitchenProgressRow>()
    // rowKey -> dishName -> accum: для combo-строк копим разбивку по блюдам.
    const comboChildren = new Map<string, Map<string, ChildAccum>>()

    for (const item of kitchenDishes) {
      if (!allowedStatuses.includes(item.status)) continue

      const fp = orderItemKey(item.modifiers, item.addons, item.removedIngredients)

      if (item.comboId) {
        const key = `combo::${item.orderItemId}`
        let row = map.get(key)

        if (!row) {
          row = {
            key,
            ids: [],
            dishName: item.comboName ?? item.dishName,
            count: 0,
            dotClass: 'dot--queued',
            unitPrice: priceMap.get(`${item.comboName}::${fp}`) ?? 0,
            totalPrice: 0,
            status: 'queued',
            isCombo: true,
            comboName: item.comboName,
            orderItemId: item.orderItemId,
            readyCount: 0,
            total: 0,
            children: [],
          }
          map.set(key, row)
          comboChildren.set(key, new Map())
        }

        row.ids.push(item.id)
        row.total++
        if (item.status === 'done') row.readyCount++

        const children = comboChildren.get(key)!
        let child = children.get(item.dishName)

        if (!child) {
          child = { dishName: item.dishName, total: 0, readyCount: 0, hasInProgress: false }
          children.set(item.dishName, child)
        }

        child.total++
        if (item.status === 'done') child.readyCount++
        if (item.status === 'in_progress') child.hasInProgress = true
      } else {
        const key = `${item.dishName}::${fp}::${item.status}`
        let row = map.get(key)

        if (!row) {
          row = {
            key,
            ids: [],
            dishName: item.dishName,
            count: 0,
            dotClass: dotFor(item.status as RowStatus),
            unitPrice: priceMap.get(`${item.dishName}::${fp}`) ?? 0,
            totalPrice: 0,
            status: item.status as RowStatus,
            isCombo: false,
            comboName: null,
            orderItemId: null,
            readyCount: 0,
            total: 0,
            children: [],
          }
          map.set(key, row)
        }

        row.ids.push(item.id)
        row.count++
        row.totalPrice = row.count * row.unitPrice
      }
    }

    // Пост-обработка комбо: разбивка по блюдам, агрегированный статус, count = кол-во
    // комбо (total делим на число уникальных блюд — структура регулярна).
    for (const [key, row] of map) {
      if (!row.isCombo) continue

      const children = comboChildren.get(key)!

      row.children = [...children.values()].map((c) => ({
        dishName: c.dishName,
        total: c.total,
        readyCount: c.readyCount,
        status: c.readyCount === c.total ? 'done' : (c.hasInProgress ? 'in_progress' : 'queued'),
      }))

      row.status = row.readyCount === row.total
        ? 'done'
        : (row.readyCount > 0 || row.children.some((c) => c.status === 'in_progress'))
            ? 'in_progress'
            : 'queued'
      row.dotClass = dotFor(row.status)
      row.count = row.children.length ? Math.round(row.total / row.children.length) : 0
      row.totalPrice = row.count * row.unitPrice
    }

    return [...map.values()]
  })

  return { kitchenProgress }
}
