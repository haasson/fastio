import type { KitchenQueueItem } from '@fastio/shared'
import { orderItemKey } from '@fastio/shared'
import type { TableSessionItem } from '../api/tables'

// Чек = подтверждённые позиции, которых уже нет в кухонном пайплайне (поданы /
// skip_kitchen). Активные кухонные единицы вычитаем:
//   • обычные блюда — по dishName+фингерпринт (частично поданное считается верно);
//   • комбо — по comboName+фингерпринт, СЧИТАЕМ количеством экземпляров, а не
//     флагом присутствия: группируем активные строки по orderItemId (экземпляр
//     комбо подаётся атомарно — все его строки разом, см. useKitchenProgress) и
//     делим число строк группы на число уникальных блюд в ней — это и есть
//     активное кол-во экземпляров. Иначе один активный экземпляр прячет из чека
//     ещё и уже поданные экземпляры того же комбо (баг двойного учёта).
// Комбо-дети не кладутся в activeByKey, чтобы не загрязнять учёт одноимённого
// отдельного блюда (комбошный «Сырник» не должен прятать отдельный «Сырник»).
export const computeServedCheckItems = (
  items: TableSessionItem[],
  kitchenDishes: KitchenQueueItem[],
): TableSessionItem[] => {
  const confirmed = items.filter((i) => i.status === 'confirmed')

  const activeByKey = new Map<string, number>()
  const comboGroups = new Map<string, { key: string; rows: number; dishes: Set<string> }>()

  for (const item of kitchenDishes) {
    if (item.status !== 'queued' && item.status !== 'in_progress' && item.status !== 'done') continue

    const fp = orderItemKey(item.modifiers, item.addons, item.removedIngredients)

    if (item.comboId) {
      const key = `${item.comboName}::${fp}`
      let group = comboGroups.get(item.orderItemId)

      if (!group) {
        group = { key, rows: 0, dishes: new Set() }
        comboGroups.set(item.orderItemId, group)
      }

      group.rows++
      group.dishes.add(item.dishName)
    } else {
      const key = `${item.dishName}::${fp}`

      activeByKey.set(key, (activeByKey.get(key) ?? 0) + 1)
    }
  }

  const activeComboByKey = new Map<string, number>()

  for (const group of comboGroups.values()) {
    const qty = group.dishes.size ? Math.round(group.rows / group.dishes.size) : 0

    activeComboByKey.set(group.key, (activeComboByKey.get(group.key) ?? 0) + qty)
  }

  const consume = (map: Map<string, number>, key: string, item: TableSessionItem): TableSessionItem | null => {
    const active = map.get(key) ?? 0
    const servedQty = item.quantity - active

    if (servedQty <= 0) {
      map.set(key, active - item.quantity)

      return null
    }

    map.set(key, 0)

    return servedQty === item.quantity ? item : { ...item, quantity: servedQty }
  }

  const result: TableSessionItem[] = []

  for (const item of confirmed) {
    const key = `${item.dishName}::${orderItemKey(item.modifiers, item.addons, item.removedIngredients)}`
    const map = activeComboByKey.has(key) ? activeComboByKey : activeByKey
    const served = consume(map, key, item)

    if (served) result.push(served)
  }

  return result
}
