import type { OrderStatus, OrderStatusGroup } from './types/order'

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
