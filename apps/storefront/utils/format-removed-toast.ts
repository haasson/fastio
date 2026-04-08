import type { RemovalReason, RemovedItem } from '@fastio/shared'

export type RemovedToast = {
  title: string
  description: string
}

const REASON_TEXT: Record<RemovalReason, string> = {
  dish_missing: 'больше недоступно',
  combo_missing: 'больше недоступно',
  modifier_invalid: 'убрано — некоторые модификаторы больше недоступны, добавьте заново',
  addon_invalid: 'убрано — некоторые добавки больше недоступны, добавьте заново',
}

export function formatRemovedToasts(removed: RemovedItem[]): RemovedToast[] {
  const seen = new Set<string>()
  const toasts: RemovedToast[] = []

  for (const { item, reason } of removed) {
    const key = `${item.dishName}::${reason}`
    if (seen.has(key)) continue
    seen.add(key)

    toasts.push({
      title: item.dishName,
      description: REASON_TEXT[reason],
    })
  }

  return toasts
}
