import { computed, ref, watch, onUnmounted, type Ref } from 'vue'
import type { Order, OrderStatus } from '@fastio/shared'
import type { OrderFilter } from '~/utils/api/orders'
import { PAGE_SIZE } from '~/utils/api/orders'
import { orderEvents } from '~/composables/data/useOrdersChannel'
import { useDatabase } from '~/composables/data/useDatabase'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'

export function useOrders(
  tenantId: Ref<string>,
  filter: Ref<OrderFilter>,
  branchId: Ref<string | null> = ref(null),
  statuses: Ref<OrderStatus[]> = ref([]),
) {
  const api = useDatabase()
  const authStore = useAuthStore()
  const tenantStore = useTenantStore()
  const _orders = ref<Order[]>([])
  const loading = ref(false)
  const page = ref(1)
  const total = ref(0)

  // API возвращает newest-first — реверс не нужен
  const orders = computed(() => _orders.value)

  const shouldInclude = (order: Order) => filter.value !== null
    && order.status === filter.value
    && (branchId.value === null || order.branchId === branchId.value)

  const fetchOrders = async () => {
    if (!tenantId.value || filter.value === null) {
      _orders.value = []
      total.value = 0

      return
    }
    loading.value = true
    try {
      const result = await api.orders.list(tenantId.value, filter.value, branchId.value, page.value)

      _orders.value = result.orders
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  // При смене фильтра/бранча сбрасываем на первую страницу
  watch([tenantId, filter, branchId], () => {
    if (page.value !== 1) {
      page.value = 1 // watch(page) сам вызовет fetchOrders
    } else {
      fetchOrders()
    }
  }, { immediate: true })

  // При смене страницы просто догружаем
  watch(page, fetchOrders)

  // Subscribe to shared channel events
  const offInsert = orderEvents.onInsert((order) => {
    if (!shouldInclude(order)) return
    // Добавляем в начало только на первой странице (newest-first)
    if (page.value === 1 && !_orders.value.find((o) => o.id === order.id)) {
      _orders.value.unshift(order)
      total.value++
    }
  })

  const offUpdate = orderEvents.onUpdate((order) => {
    const idx = _orders.value.findIndex((o) => o.id === order.id)

    if (idx === -1) return
    if (!shouldInclude(order)) {
      _orders.value.splice(idx, 1)
      total.value = Math.max(0, total.value - 1)
    } else {
      _orders.value[idx] = order
    }
  })

  const offDelete = orderEvents.onDelete(({ id }) => {
    const existed = _orders.value.some((o) => o.id === id)

    _orders.value = _orders.value.filter((o) => o.id !== id)
    if (existed) total.value = Math.max(0, total.value - 1)
  })

  onUnmounted(() => {
    offInsert()
    offUpdate()
    offDelete()
  })

  const updateStatus = async (orderId: string, newStatusId: string) => {
    const i = _orders.value.findIndex((o) => o.id === orderId)
    const oldStatusId = i !== -1 ? _orders.value[i].status : null

    await api.orders.updateStatus(orderId, newStatusId)

    // Log event (fire-and-forget)
    if (authStore.user && oldStatusId) {
      const oldStatus = statuses.value.find((s) => s.id === oldStatusId)
      const newStatus = statuses.value.find((s) => s.id === newStatusId)

      api.orderEvents.add({
        orderId,
        tenantId: tenantId.value,
        actorId: authStore.user.id,
        actorName: authStore.user.email ?? null,
        actorRole: tenantStore.currentRole ?? null,
        eventType: 'status_changed',
        meta: {
          from_id: oldStatusId,
          from_name: oldStatus?.name ?? null,
          to_id: newStatusId,
          to_name: newStatus?.name ?? null,
        },
      }).catch(console.error)
    }

    if (i === -1) return
    if (newStatusId !== filter.value) {
      _orders.value.splice(i, 1)
      total.value = Math.max(0, total.value - 1)
    } else {
      _orders.value[i] = { ..._orders.value[i], status: newStatusId }
    }
  }

  return { orders, loading, updateStatus, page, pageSize: PAGE_SIZE, total }
}
