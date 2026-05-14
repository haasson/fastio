import { computed, ref, watch, onUnmounted, type Ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import type { Order, OrderStatus } from '@fastio/shared'
import { getAllowedStatuses } from '@fastio/shared'
import type { OrderFilter } from '../api/orders'
import { orderEvents } from './useOrdersChannel'
import { useDatabase } from '~/shared/data/useDatabase'
import { useAuthStore } from '~/shared/stores/auth'
import { useTenantStore } from '~/shared/stores/tenant'
import { reportError } from '~/shared/utils/reportError'
import { useKitchenStatusBlock } from '~/features/kitchen'
import { useAuditLog } from '~/features/audit-log'

export type UseOrdersOptions = {
  branchId?: Ref<string | null>
  statuses?: Ref<OrderStatus[]>
  search?: Ref<string>
  deliveryTypes?: Ref<string[]>
  excludeDeliveryTypes?: string[]
  paymentTypes?: Ref<string[]>
  filterBranchIds?: Ref<string[]>
  sortBy?: Ref<string>
  sortDir?: Ref<'asc' | 'desc'>
  pageSize?: Ref<number>
}

export function useOrders(
  tenantId: Ref<string>,
  filter: Ref<OrderFilter>,
  options: UseOrdersOptions = {},
) {
  const api = useDatabase()
  const authStore = useAuthStore()
  const tenantStore = useTenantStore()
  const { checkKitchenBlock } = useKitchenStatusBlock()
  const { log } = useAuditLog()
  const _orders = ref<Order[]>([])
  const loading = ref(false)
  const page = ref(1)
  const total = ref(0)
  const pendingUpdate = ref(false)

  const statuses = options.statuses ?? ref([])

  const orders = computed(() => _orders.value)
  const realtimeVersion = ref(0)

  const shouldInclude = (order: Order) => {
    if (filter.value === null) return false
    if (order.status !== filter.value) return false
    const branchId = options.branchId?.value ?? null

    if (branchId !== null && order.branchId !== branchId) return false
    if (options.excludeDeliveryTypes?.includes(order.deliveryType)) return false

    return true
  }

  const hasActiveFilters = () => (options.search?.value ?? '') !== ''
    || (options.deliveryTypes?.value ?? []).length > 0
    || (options.paymentTypes?.value ?? []).length > 0
    || (options.filterBranchIds?.value ?? []).length > 0

  const fetchOrders = async () => {
    if (!tenantId.value || filter.value === null) {
      _orders.value = []
      total.value = 0

      return
    }
    loading.value = true
    try {
      const result = await api.orders.list(tenantId.value, filter.value, {
        branchId: options.branchId?.value ?? null,
        filterBranchIds: options.filterBranchIds?.value ?? [],
        page: page.value,
        pageSize: options.pageSize?.value,
        search: options.search?.value,
        deliveryTypes: options.deliveryTypes?.value ?? [],
        excludeDeliveryTypes: options.excludeDeliveryTypes ?? [],
        paymentTypes: options.paymentTypes?.value ?? [],
        sortBy: options.sortBy?.value ?? 'created_at',
        sortDir: options.sortDir?.value ?? 'desc',
      })

      _orders.value = result.orders
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  // Основные фильтры — немедленно
  watch(
    [tenantId, filter, () => options.branchId?.value ?? null],
    () => {
      pendingUpdate.value = false
      if (page.value !== 1) page.value = 1
      else fetchOrders()
    },
    { immediate: true },
  )

  // Колоночные фильтры + сортировка — немедленно
  watch(
    [
      () => (options.deliveryTypes?.value ?? []).join(','),
      () => (options.paymentTypes?.value ?? []).join(','),
      () => (options.filterBranchIds?.value ?? []).join(','),
      () => options.sortBy?.value ?? 'created_at',
      () => options.sortDir?.value ?? 'desc',
    ],
    () => {
      if (page.value !== 1) page.value = 1
      else fetchOrders()
    },
  )

  // Поиск — с дебаунсом
  watchDebounced(
    () => options.search?.value ?? '',
    () => {
      pendingUpdate.value = false
      if (page.value !== 1) page.value = 1
      else fetchOrders()
    },
    { debounce: 400 },
  )

  watch(page, fetchOrders)

  // Размер страницы — сбрасываем на первую и перезапрашиваем
  if (options.pageSize) {
    watch(options.pageSize, () => {
      if (page.value !== 1) page.value = 1
      else fetchOrders()
    })
  }

  const offInsert = orderEvents.onInsert((order) => {
    if (!shouldInclude(order)) return
    if (hasActiveFilters()) {
      pendingUpdate.value = true

      return
    }
    if (page.value === 1 && !_orders.value.find((o) => o.id === order.id)) {
      _orders.value.unshift(order)
      total.value++
      realtimeVersion.value++
    }
  })

  const offUpdate = orderEvents.onUpdate((order) => {
    const idx = _orders.value.findIndex((o) => o.id === order.id)
    const included = shouldInclude(order)

    if (idx === -1) {
      if (included) {
        if (hasActiveFilters()) {
          pendingUpdate.value = true
        } else if (page.value === 1) {
          _orders.value.unshift(order)
          total.value++
        }
        realtimeVersion.value++
      }

      return
    }
    if (!included) {
      _orders.value.splice(idx, 1)
      total.value = Math.max(0, total.value - 1)
    } else {
      _orders.value[idx] = order
    }
    realtimeVersion.value++
  })

  const offDelete = orderEvents.onDelete(({ id }) => {
    const existed = _orders.value.some((o) => o.id === id)

    _orders.value = _orders.value.filter((o) => o.id !== id)
    if (existed) {
      total.value = Math.max(0, total.value - 1)
      realtimeVersion.value++
    }
  })

  onUnmounted(() => {
    offInsert()
    offUpdate()
    offDelete()
  })

  const updateStatus = async (orderId: string, newStatusId: string) => {
    const i = _orders.value.findIndex((o) => o.id === orderId)
    const oldStatusId = i !== -1 ? _orders.value[i].status : null

    // Validate transition is allowed
    const oldStatus = statuses.value.find((s) => s.id === oldStatusId)
    const newStatus = statuses.value.find((s) => s.id === newStatusId)

    if (oldStatus && newStatus) {
      const allowed = getAllowedStatuses(oldStatus.groupType, statuses.value)

      if (!allowed.some((s) => s.id === newStatusId)) return
    }

    // Block manual status changes while kitchen is active (except cancel)
    const order = _orders.value.find((o) => o.id === orderId)

    if (!order) {
      console.warn(`[useOrders] order ${orderId} not found in local list, skipping kitchen check`)
    } else {
      const { blocked } = await checkKitchenBlock(order, newStatus?.groupType)

      if (blocked) return
    }

    await api.orders.updateStatus(orderId, newStatusId)

    // Clean up kitchen queue when order reaches a terminal state
    if (newStatus?.groupType === 'cancelled') {
      api.kitchenQueue.cancelForOrders([orderId]).catch(reportError)
      log({
        action: 'order.cancel',
        entityType: 'order',
        entityId: orderId,
        entityName: order?.orderNumber ?? null,
        payload: { fromStatus: oldStatus?.name ?? null, toStatus: newStatus.name },
      })
    } else if (newStatus?.groupType === 'completed') {
      api.kitchenQueue.serveAllForOrders([orderId], authStore.user!.id).catch(reportError)
    }

    if (authStore.user && oldStatusId) {
      api.orderEvents.add({
        orderId,
        tenantId: tenantId.value,
        actorId: authStore.user.id,
        actorName: authStore.user.user_metadata?.full_name || authStore.user.email || null,
        actorRole: tenantStore.currentRoleName ?? null,
        eventType: 'status_changed',
        meta: {
          from_id: oldStatusId,
          from_name: oldStatus?.name ?? null,
          to_id: newStatusId,
          to_name: newStatus?.name ?? null,
        },
      }).catch(reportError)
    }

    if (i === -1) return
    if (newStatusId !== filter.value) {
      _orders.value.splice(i, 1)
      total.value = Math.max(0, total.value - 1)
    } else {
      _orders.value[i] = { ..._orders.value[i], status: newStatusId }
    }
  }

  const refresh = () => {
    pendingUpdate.value = false
    fetchOrders()
  }

  return { orders, loading, updateStatus, page, total, pendingUpdate, refresh, realtimeVersion }
}
