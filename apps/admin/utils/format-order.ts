import type { OrderEventType } from '@fastio/shared'
import { PAYMENT_TYPE_LABELS, DELIVERY_TYPE_LABELS } from '~/config/order-options'

type EventMeta = Record<string, unknown>

const ORDER_SOURCE_LABELS: Record<string, string> = {
  storefront: 'сторфронт',
  admin: 'администрация',
}

const EVENT_TEXT_FORMATTERS: Partial<Record<OrderEventType, (meta: EventMeta) => string>> = {
  order_created: (m) => `Заказ создан (${ORDER_SOURCE_LABELS[String(m.source)] ?? 'администрация'})`,
  status_changed: (m) => `${m.from_name ?? m.from_id ?? '?'} → ${m.to_name ?? m.to_id ?? '?'}`,
}

export const formatEventText = (eventType: string, meta: EventMeta): string => EVENT_TEXT_FORMATTERS[eventType as OrderEventType]?.(meta) ?? eventType

export const formatFieldValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'payment_type') return PAYMENT_TYPE_LABELS[String(value)] ?? String(value)
  if (field === 'delivery_type') return DELIVERY_TYPE_LABELS[String(value)] ?? String(value)
  if (field === 'delivery_fee') return `${value} ₽`

  return String(value)
}
