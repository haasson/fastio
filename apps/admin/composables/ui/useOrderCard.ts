import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useNow, createSharedComposable } from '@vueuse/core'
import type { Order, OrderStatus } from '@fastio/shared'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { formatRelativeTime, getAllowedStatuses } from '@fastio/shared'

const useSharedNow = createSharedComposable(() => useNow({ interval: 30_000 }))

export function useOrderCard(order: Ref<Order>) {
  const { statuses } = storeToRefs(useOrderStatusesStore())

  const currentStatus = computed(() => statuses.value.find((s) => s.id === order.value.status) ?? null)
  const quickActionStatuses = computed(() => {
    const current = statuses.value.find((s) => s.id === order.value.status)

    if (!current?.quickActions?.length) return []

    const allowed = getAllowedStatuses(current.groupType, statuses.value)

    return current.quickActions
      .map((id) => allowed.find((s) => s.id === id))
      .filter(Boolean) as OrderStatus[]
  })
  const now = useSharedNow()
  const relativeTime = computed(() => formatRelativeTime(order.value.createdAt, now.value))

  return { currentStatus, quickActionStatuses, relativeTime }
}
