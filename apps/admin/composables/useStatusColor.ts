import { COLORS } from '@fastio/ui'
import { STATUS_GROUP_COLORS } from '~/config/order-status-groups'
import { useOrderStatusesStore } from '~/stores/order-statuses'

export const useStatusColor = () => {
  const { statuses } = useOrderStatusesStore()

  const getStatusColor = (statusId: unknown): string => {
    const status = statuses.find((s) => s.id === statusId)

    return status ? STATUS_GROUP_COLORS[status.groupType] ?? COLORS.GREY_400 : COLORS.GREY_400
  }

  return { getStatusColor }
}
