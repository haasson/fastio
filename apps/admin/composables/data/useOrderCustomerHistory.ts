import { ref, watch, type Ref } from 'vue'
import type { Order } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

export const useOrderCustomerHistory = (tenantId: string, order: Ref<Order | null>) => {
  const api = useDatabase()
  const customerOrders = ref<Order[]>([])

  watch(
    () => order.value?.customerPhone,
    async (phone) => {
      if (!phone || !order.value) {
        customerOrders.value = []

        return
      }
      const { orders } = await api.orders.list(tenantId, null, { search: phone, pageSize: 20 })

      if (order.value?.customerPhone !== phone) return
      customerOrders.value = orders.filter((o) => o.id !== order.value!.id)
    },
    { immediate: true },
  )

  return { customerOrders }
}
