import type { KitchenQueueItem } from '@fastio/shared'
import { orderItemKey } from '@fastio/shared'
import type { TableSessionItem } from '../api/tables'

// Чек = подтверждённые позиции, которых уже нет в кухонном пайплайне (поданы /
// skip_kitchen). Активные кухонные единицы вычитаем:
//   • обычные блюда — по dishName+фингерпринт (частично поданное считается верно);
//   • комбо — по comboName: пока хоть одна кухонная строка комбо активна
//     (queued/in_progress/done), всё комбо вне чека. Комбо неделимо — попадает в
//     чек только когда ВСЕ его строки покинули пайплайн (served).
// Комбо-дети не кладутся в activeByKey, чтобы не загрязнять учёт одноимённого
// отдельного блюда (комбошный «Сырник» не должен прятать отдельный «Сырник»).
export const computeServedCheckItems = (
  items: TableSessionItem[],
  kitchenDishes: KitchenQueueItem[],
): TableSessionItem[] => {
  const confirmed = items.filter((i) => i.status === 'confirmed')

  const activeByKey = new Map<string, number>()
  const activeComboNames = new Set<string>()

  for (const item of kitchenDishes) {
    if (item.status !== 'queued' && item.status !== 'in_progress' && item.status !== 'done') continue

    const fp = orderItemKey(item.modifiers, item.addons, item.removedIngredients)

    if (item.comboId) {
      activeComboNames.add(`${item.comboName}::${fp}`)
    } else {
      const key = `${item.dishName}::${fp}`

      activeByKey.set(key, (activeByKey.get(key) ?? 0) + 1)
    }
  }

  const result: TableSessionItem[] = []

  for (const item of confirmed) {
    const key = `${item.dishName}::${orderItemKey(item.modifiers, item.addons, item.removedIngredients)}`

    if (activeComboNames.has(key)) continue

    const active = activeByKey.get(key) ?? 0
    const servedQty = item.quantity - active

    if (servedQty <= 0) {
      activeByKey.set(key, active - item.quantity)
      continue
    }

    activeByKey.set(key, 0)
    result.push(servedQty === item.quantity ? item : { ...item, quantity: servedQty })
  }

  return result
}
