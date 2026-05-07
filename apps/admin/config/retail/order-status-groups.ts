import type { OrderStatusGroup } from '@fastio/shared'
import { COLORS } from '@fastio/kit'

export const STATUS_GROUP_TAG_TYPES: Record<OrderStatusGroup, 'primary' | 'warning' | 'success' | 'default' | 'error'> = {
  new: 'primary',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error',
}

const TAG_TYPE_COLOR: Record<string, string> = {
  primary: COLORS.PRIMARY,
  warning: COLORS.WARNING,
  success: COLORS.SUCCESS,
  error: COLORS.ERROR,
  default: COLORS.GREY_500,
}

export const STATUS_GROUP_COLORS: Record<OrderStatusGroup, string> = Object.fromEntries(
  (Object.entries(STATUS_GROUP_TAG_TYPES) as [OrderStatusGroup, string][])
    .map(([group, type]) => [group, TAG_TYPE_COLOR[type]]),
) as Record<OrderStatusGroup, string>

export const STATUS_GROUP_LABELS: Record<OrderStatusGroup, string> = {
  new: 'Новый',
  in_progress: 'В процессе',
  completed: 'Выполнен',
  cancelled: 'Отменён',
}
