import type { KitchenQueueItem } from './types/kitchen'

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
