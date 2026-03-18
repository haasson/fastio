import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useNow, createSharedComposable } from '@vueuse/core'
import type { Order, OrderStatus } from '@fastio/shared'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { formatRelativeTime } from '~/utils/formatRelativeTime'

const useSharedNow = createSharedComposable(() => useNow({ interval: 30_000 }))

export function useOrderCard(order: Ref<Order>) {
  const { statuses } = storeToRefs(useOrderStatusesStore())

  const shortId = computed(() => order.value.id.slice(0, 6).toUpperCase())
  const currentStatus = computed(() => statuses.value.find((s) => s.id === order.value.status) ?? null)
  const quickActionStatuses = computed(() => {
    const current = statuses.value.find((s) => s.id === order.value.status)

    if (!current?.quickActions?.length) return []

    return current.quickActions.map((id) => statuses.value.find((s) => s.id === id)).filter(Boolean) as OrderStatus[]
  })
  const now = useSharedNow()
  const relativeTime = computed(() => formatRelativeTime(order.value.createdAt, now.value))

  return { shortId, currentStatus, quickActionStatuses, relativeTime }
}
