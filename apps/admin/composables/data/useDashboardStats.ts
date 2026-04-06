import { ref, computed, watch, onUnmounted, type Ref } from 'vue'
import type { OrderDeliveryType } from '@fastio/shared'
import { orderEvents } from '~/composables/data/useOrdersChannel'
import { useDatabase } from '~/composables/data/useDatabase'

export type DashboardPeriod = 'today' | 'week' | 'month'

type StatOrder = {
  id: string
  total: number
  createdAt: string
  deliveryType: OrderDeliveryType
  items: Array<{ dishName: string; quantity: number; categoryName: string | null }>
}

const getPeriodRange = (period: DashboardPeriod): { dateFrom: string; dateTo: string } => {
  const now = new Date()
  const dateTo = now.toISOString()

  if (period === 'today') {
    const start = new Date(now)

    start.setHours(0, 0, 0, 0)

    return { dateFrom: start.toISOString(), dateTo }
  }

  if (period === 'week') {
    const start = new Date(now)

    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)

    return { dateFrom: start.toISOString(), dateTo }
  }

  const start = new Date(now)

  start.setDate(start.getDate() - 29)
  start.setHours(0, 0, 0, 0)

  return { dateFrom: start.toISOString(), dateTo }
}

const getDayKey = (iso: string) => iso.slice(0, 10)

export const useDashboardStats = (
  tenantId: Ref<string>,
  period: Ref<DashboardPeriod>,
  branchId: Ref<string | null>,
) => {
  const api = useDatabase()
  const orders = ref<StatOrder[]>([])
  const loading = ref(false)

  const fetchStats = async () => {
    if (!tenantId.value) return
    loading.value = true
    try {
      const { dateFrom, dateTo } = getPeriodRange(period.value)

      orders.value = await api.orders.getStatsForPeriod(
        tenantId.value,
        dateFrom,
        dateTo,
        branchId.value,
      )
    } finally {
      loading.value = false
    }
  }

  watch([tenantId, period, branchId], fetchStats, { immediate: true })

  const offInsert = orderEvents.onInsert((order) => {
    if (branchId.value !== null && order.branchId !== branchId.value) return
    const { dateFrom } = getPeriodRange(period.value)

    if (order.createdAt >= dateFrom) {
      orders.value.push({
        id: order.id,
        total: order.total,
        createdAt: order.createdAt,
        deliveryType: order.deliveryType,
        items: order.items.map((i) => ({ dishName: i.dishName, quantity: i.quantity, categoryName: i.categoryName ?? null })),
      })
    }
  })

  const offUpdate = orderEvents.onUpdate((order) => {
    const idx = orders.value.findIndex((o) => o.id === order.id)

    if (idx !== -1) {
      orders.value[idx] = {
        ...orders.value[idx],
        total: order.total,
        deliveryType: order.deliveryType,
      }
    }
  })

  const offDelete = orderEvents.onDelete(({ id }) => {
    orders.value = orders.value.filter((o) => o.id !== id)
  })

  onUnmounted(() => {
    offInsert()
    offUpdate()
    offDelete()
  })

  const revenue = computed(() => orders.value.reduce((sum, o) => sum + (o.total ?? 0), 0))

  const ordersCount = computed(() => orders.value.length)

  const avgOrderValue = computed(() => ordersCount.value > 0 ? Math.round(revenue.value / ordersCount.value) : 0)

  const revenueByDay = computed(() => {
    const map: Record<string, number> = {}

    for (const o of orders.value) {
      const key = getDayKey(o.createdAt)

      map[key] = (map[key] ?? 0) + o.total
    }

    const { dateFrom } = getPeriodRange(period.value)
    const days: Array<{ date: string; value: number }> = []
    const startDate = new Date(dateFrom)
    const now = new Date()

    // Only show per-day breakdown for week/month, for today it's just one bar
    if (period.value === 'today') {
      const key = getDayKey(now.toISOString())

      return [{ date: key, value: map[key] ?? 0 }]
    }

    const current = new Date(startDate)

    current.setHours(0, 0, 0, 0)
    while (current <= now) {
      const key = current.toISOString().slice(0, 10)

      days.push({ date: key, value: map[key] ?? 0 })
      current.setDate(current.getDate() + 1)
    }

    return days
  })

  const ordersByType = computed(() => {
    const counts = { delivery: 0, pickup: 0, dine_in: 0 }

    for (const o of orders.value) {
      if (o.deliveryType in counts) {
        counts[o.deliveryType as keyof typeof counts]++
      }
    }

    return counts
  })

  const allItemCounts = computed(() => {
    const map: Record<string, { count: number; categoryName: string | null }> = {}

    for (const o of orders.value) {
      for (const item of o.items) {
        if (!map[item.dishName]) map[item.dishName] = { count: 0, categoryName: item.categoryName }
        map[item.dishName].count += item.quantity
      }
    }

    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, { count, categoryName }]) => ({ name, count, categoryName }))
  })

  const categories = computed(() => {
    const set = new Set<string>()

    for (const item of allItemCounts.value) {
      if (item.categoryName) set.add(item.categoryName)
    }

    return [...set].sort()
  })

  return {
    loading,
    revenue,
    ordersCount,
    avgOrderValue,
    revenueByDay,
    ordersByType,
    allItemCounts,
    categories,
    refresh: fetchStats,
  }
}
