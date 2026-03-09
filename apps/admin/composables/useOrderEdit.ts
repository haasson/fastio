import { useDatabase } from '~/composables/useDatabase'
import type { OrderUpdateData } from '~/utils/api/orders'

export const useOrderEdit = () => {
  const api = useDatabase()

  const update = (orderId: string, data: OrderUpdateData) => api.orders.update(orderId, data)

  return { update }
}
