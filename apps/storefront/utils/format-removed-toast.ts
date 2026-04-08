import type { RemovalReason, RemovedItem } from '@fastio/shared'

export type RemovedToast = {
  title: string
  description: string
}

const REASON_DESCRIPTION: Record<RemovalReason, string> = {
  dish_missing: 'блюда больше нет в меню',
  combo_missing: 'комбо больше нет в меню',
  modifier_invalid: 'некоторые модификаторы больше недоступны',
  addon_invalid: 'некоторые добавки больше недоступны',
}

export function formatRemovedToasts(removed: RemovedItem[]): RemovedToast[] {
  const seen = new Set<string>()
  const toasts: RemovedToast[] = []

  for (const { item, reason } of removed) {
    const key = `${item.dishName}::${reason}`
    if (seen.has(key)) continue
    seen.add(key)

    toasts.push({
      title: `${item.dishName} убрано из корзины`,
      description: REASON_DESCRIPTION[reason],
    })
  }

  return toasts
}
