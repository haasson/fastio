import { COLORS } from '@fastio/ui'
import type { OrderEventType } from '@fastio/shared'

export const EVENT_COLORS: Record<OrderEventType, string> = {
  order_created: COLORS.GREEN_500,
  status_changed: COLORS.BLUE_500,
  field_updated: COLORS.ORANGE_400,
  items_updated: COLORS.ORANGE_500,
}

export const FIELD_LABELS: Record<string, string> = {
  customer_name: 'Имя клиента',
  customer_phone: 'Телефон',
  address: 'Адрес',
  payment_type: 'Способ оплаты',
  delivery_fee: 'Стоимость доставки',
  delivery_type: 'Тип доставки',
}
