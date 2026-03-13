import { computed, type Ref } from 'vue'
import { useNow } from '@vueuse/core'
import type { Order, OrderStatus } from '@fastio/shared'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useTenantStore } from '~/stores/tenant'
import { formatRelativeTime } from '~/utils/formatRelativeTime'

export function useOrderCard(order: Ref<Order>) {
  const { statuses } = useOrderStatusesStore()
  const tenantStore = useTenantStore()

  const deliveryEnabled = computed(() => tenantStore.tenant?.deliveryEnabled ?? true)
  const shortId = computed(() => order.value.id.slice(0, 6).toUpperCase())
  const currentStatus = computed(() => statuses.find((s) => s.id === order.value.status) ?? null)
  const quickActionStatuses = computed(() => {
    const current = statuses.find((s) => s.id === order.value.status)

    if (!current?.quickActions?.length) return []

    return current.quickActions.map((id) => statuses.find((s) => s.id === id)).filter(Boolean) as OrderStatus[]
  })
  const now = useNow({ interval: 30_000 })
  const relativeTime = computed(() => formatRelativeTime(order.value.createdAt, now.value))

  return { deliveryEnabled, shortId, currentStatus, quickActionStatuses, relativeTime }
}
