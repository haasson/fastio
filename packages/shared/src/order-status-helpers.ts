import type { OrderStatus, OrderStatusGroup } from './types/order'
import type { KitchenConfig } from './types/kitchen'

const ALLOWED_TARGET_GROUPS: Record<OrderStatusGroup, OrderStatusGroup[]> = {
  new: ['new', 'in_progress', 'completed', 'cancelled'],
  in_progress: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export const getAllowedStatuses = (currentGroup: OrderStatusGroup, allStatuses: OrderStatus[]): OrderStatus[] => {
  const allowed = ALLOWED_TARGET_GROUPS[currentGroup]

  return allStatuses.filter((s) => allowed.includes(s.groupType))
}

// Просрочен ли предзаказ: указанное время уже в прошлом.
// Используется чтобы НЕ загонять опоздавший заказ в холдинг-статус «жди время»
// (ждать уже нечего) и подсветить его оператору.
export const isScheduledOverdue = (scheduledAt: string | null | undefined, now: number = Date.now()): boolean => {
  if (!scheduledAt) return false

  const ts = new Date(scheduledAt).getTime()

  return !Number.isNaN(ts) && ts < now
}

export const getKitchenAutoStatuses = (config: KitchenConfig | null | undefined): string[] => {
  if (!config) return []

  return [
    config.cookingStatusId,
    config.completedStatusMap?.delivery,
    config.completedStatusMap?.pickup,
    config.completedStatusMap?.dine_in,
  ].filter((id): id is string => !!id)
}
