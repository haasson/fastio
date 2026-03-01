import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import type { Order, OrderStatus } from '@fastfood-saas/shared'

export type OrderFilter = 'active' | 'completed' | 'cancelled' | 'all'

// Следующий статус по флоу + лейбл кнопки
export const nextStatus: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: 'accepted', label: 'Принять' },
  accepted: { status: 'cooking', label: 'Готовится' },
  cooking: { status: 'ready', label: 'Готово' },
  ready: { status: 'delivering', label: 'Передать курьеру' },
  delivering: { status: 'completed', label: 'Доставлен' },
}

export const nextStatusPickup: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  ...nextStatus,
  ready: { status: 'completed', label: 'Выдать' },
}

export const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  new: { label: 'Новый', color: '#3b82f6' },
  accepted: { label: 'Принят', color: '#8b5cf6' },
  cooking: { label: 'Готовится', color: '#f59e0b' },
  ready: { label: 'Готов', color: '#10b981' },
  delivering: { label: 'Доставляется', color: '#06b6d4' },
  completed: { label: 'Завершён', color: '#6b7280' },
  cancelled: { label: 'Отменён', color: '#ef4444' },
}

const activeStatuses: OrderStatus[] = ['new', 'accepted', 'cooking', 'ready', 'delivering']

export function useOrders(tenantId: Ref<string>, filter: Ref<OrderFilter>) {
  const { $db } = useNuxtApp()
  const orders = ref<Order[]>([])
  const loading = ref(true)

  let unsubscribe: (() => void) | null = null

  watch(
    [tenantId, filter],
    ([tid, f]) => {
      unsubscribe?.()
      orders.value = []

      if (!tid) return

      loading.value = true

      const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]

      if (f === 'active') {
        constraints.push(where('status', 'in', activeStatuses))
      } else if (f === 'completed') {
        constraints.push(where('status', '==', 'completed'))
      } else if (f === 'cancelled') {
        constraints.push(where('status', '==', 'cancelled'))
      }

      const q = query(
        collection($db, 'tenants', tid, 'orders'),
        ...constraints,
      )

      unsubscribe = onSnapshot(q, (snap) => {
        orders.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
        loading.value = false
      })
    },
    { immediate: true },
  )

  onUnmounted(() => unsubscribe?.())

  async function updateStatus(orderId: string, status: OrderStatus) {
    await updateDoc(doc($db, 'tenants', tenantId.value, 'orders', orderId), { status })
  }

  async function cancel(orderId: string) {
    await updateStatus(orderId, 'cancelled')
  }

  return { orders, loading, updateStatus, cancel }
}
