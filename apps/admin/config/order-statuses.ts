import type { OrderStatus } from '@fastio/shared'

export const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  new: { label: 'Новый', color: '#3b82f6' },
  accepted: { label: 'Принят', color: '#8b5cf6' },
  cooking: { label: 'Готовится', color: '#f59e0b' },
  ready: { label: 'Готов', color: '#10b981' },
  delivering: { label: 'Доставляется', color: '#06b6d4' },
  completed: { label: 'Завершён', color: '#6b7280' },
  cancelled: { label: 'Отменён', color: '#ef4444' },
}

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
