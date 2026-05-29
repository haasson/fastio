import type { KitchenQueueItem } from './types/kitchen'

export type DishDiff = {
  addedAddons: string[]
  removedAddons: string[]
  restoredIngredients: string[]  // removed in cancelled, but NOT removed in candidate (restored)
  newlyRemovedIngredients: string[]  // NOT removed in cancelled, but removed in candidate
}

export type SubstituteMatch = {
  type: 'exact' | 'similar'
  cancelledItem: KitchenQueueItem  // snapshot — safe to render even if item leaves items[]
  candidate: KitchenQueueItem
  diff: DishDiff
}

// groupName:optionName — чтобы "Средний/Размер" и "Средний/Острота" не давали одинаковый ключ
const normModifierKey = (item: KitchenQueueItem): string =>
  item.modifiers.map((m) => `${m.groupName}\x01${m.optionName}`).sort().join('\0')

export const findSubstitute = (
  cancelled: KitchenQueueItem,
  queued: KitchenQueueItem[],
): SubstituteMatch | null => {
  if (!cancelled.dishId) return null

  const cancelledModKey = normModifierKey(cancelled)
  const candidates = queued.filter(
    (q) => q.status === 'queued' && q.dishId === cancelled.dishId && normModifierKey(q) === cancelledModKey,
  )

  if (!candidates.length) return null

  const scoredMatches: SubstituteMatch[] = candidates.map((candidate) => {
    const cancelledAddonSet = new Set(cancelled.addons.map((a) => a.addonName))
    const candidateAddonSet = new Set(candidate.addons.map((a) => a.addonName))
    const cancelledRemovedSet = new Set(cancelled.removedIngredients)
    const candidateRemovedSet = new Set(candidate.removedIngredients)

    const addedAddons = [...candidateAddonSet].filter((a) => !cancelledAddonSet.has(a))
    const removedAddons = [...cancelledAddonSet].filter((a) => !candidateAddonSet.has(a))
    const restoredIngredients = [...cancelledRemovedSet].filter((i) => !candidateRemovedSet.has(i))
    const newlyRemovedIngredients = [...candidateRemovedSet].filter((i) => !cancelledRemovedSet.has(i))

    const isExact = !addedAddons.length && !removedAddons.length && !restoredIngredients.length && !newlyRemovedIngredients.length

    return {
      type: isExact ? 'exact' : 'similar',
      cancelledItem: cancelled,
      candidate,
      diff: { addedAddons, removedAddons, restoredIngredients, newlyRemovedIngredients },
    }
  })

  return scoredMatches.find((m) => m.type === 'exact') ?? scoredMatches.find((m) => m.type === 'similar') ?? null
}

export const isKitchenItemDone = (item: KitchenQueueItem): boolean =>
  item.status === 'done' || item.status === 'served'

export const getOrderPhase = (items: KitchenQueueItem[]): 'cooking' | 'collecting' | 'ready' | 'cancelled' => {
  const activeItems = items.filter((i) => i.status !== 'cancelled')

  if (activeItems.length === 0) return 'cancelled'
  if (activeItems.every(isKitchenItemDone)) return 'ready'
  if (activeItems.filter((i) => !i.skipKitchen).every(isKitchenItemDone)) return 'collecting'

  return 'cooking'
}

const WARNING_THRESHOLD_RATIO = 2 / 3

export const getKitchenUrgencyLevel = (
  createdAt: string,
  now: Date,
  thresholdMinutes: number,
): 'normal' | 'warning' | 'critical' => {
  const elapsedMin = (now.getTime() - new Date(createdAt).getTime()) / 60_000

  if (elapsedMin >= thresholdMinutes) return 'critical'
  if (elapsedMin >= thresholdMinutes * WARNING_THRESHOLD_RATIO) return 'warning'

  return 'normal'
}

export const formatKitchenElapsed = (isoDate: string, now: Date): string => {
  const min = Math.floor((now.getTime() - new Date(isoDate).getTime()) / 60_000)

  if (min < 1) return '<1 мин'
  if (min < 60) return `${min} мин`

  const h = Math.floor(min / 60)
  const m = min % 60

  return m > 0 ? `${h}ч ${m}м` : `${h}ч`
}
