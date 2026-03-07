import { computed, ref, watch, onUnmounted, type Ref } from 'vue'
import type { Order } from '@fastio/shared'
import type { OrderFilter } from '~/utils/api/orders'
import { orderEvents } from '~/composables/useOrdersChannel'
import { useSupabaseApi } from '~/composables/useSupabaseApi'

export function useOrders(
  tenantId: Ref<string>,
  filter: Ref<OrderFilter>,
  branchId: Ref<string | null> = ref(null),
) {
  const api = useSupabaseApi()
  const _orders = ref<Order[]>([])
  const loading = ref(false)

  // Stored ascending (oldest-first), reversed for display (newest-first)
  const orders = computed(() => [..._orders.value].reverse())

  const shouldInclude = (order: Order) => filter.value !== null
    && order.status === filter.value
    && (branchId.value === null || order.branchId === branchId.value)

  const fetchOrders = async () => {
    if (!tenantId.value || filter.value === null) {
      _orders.value = []

      return
    }
    loading.value = true
    try {
      _orders.value = await api.orders.list(tenantId.value, filter.value, branchId.value)
    } finally {
      loading.value = false
    }
  }

  watch([tenantId, filter, branchId], fetchOrders, { immediate: true })

  // Subscribe to shared channel events
  const offInsert = orderEvents.onInsert((order) => {
    if (!shouldInclude(order)) return
    if (!_orders.value.find((o) => o.id === order.id)) _orders.value.push(order)
  })

  const offUpdate = orderEvents.onUpdate((order) => {
    const idx = _orders.value.findIndex((o) => o.id === order.id)

    if (idx === -1) return
    if (!shouldInclude(order)) {
      _orders.value.splice(idx, 1)
    } else {
      _orders.value[idx] = order
    }
  })

  const offDelete = orderEvents.onDelete(({ id }) => {
    _orders.value = _orders.value.filter((o) => o.id !== id)
  })

  onUnmounted(() => {
    offInsert()
    offUpdate()
    offDelete()
  })

  const updateStatus = async (orderId: string, status: string) => {
    await api.orders.updateStatus(orderId, status)
    const i = _orders.value.findIndex((o) => o.id === orderId)

    if (i === -1) return
    if (status !== filter.value) {
      _orders.value.splice(i, 1)
    } else {
      _orders.value[i] = { ..._orders.value[i], status }
    }
  }

  return { orders, loading, updateStatus }
}
