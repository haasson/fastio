import type { IconName } from '@fastio/ui'

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта при получении',
  online: 'Онлайн',
}

export const DELIVERY_TYPE_LABELS: Record<string, string> = {
  delivery: 'Доставка',
  pickup: 'Самовывоз',
}

export const PAYMENT_OPTIONS = [
  { label: 'Наличные', value: 'cash' },
  { label: 'Карта при получении', value: 'card' },
]

export const DELIVERY_OPTIONS = [
  { label: 'Доставка', value: 'delivery' },
  { label: 'Самовывоз', value: 'pickup' },
]

export const PAYMENT_ICON_MAP: Record<string, IconName> = {
  cash: 'banknote',
  card: 'creditCard',
  online: 'smartphone',
}
