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

export const getKitchenAutoStatuses = (config: KitchenConfig | null | undefined): string[] => {
  if (!config) return []

  return [
    config.cookingStatusId,
    config.completedStatusMap?.delivery,
    config.completedStatusMap?.pickup,
    config.completedStatusMap?.dine_in,
  ].filter((id): id is string => !!id)
}
