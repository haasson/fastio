import type { OrderItem } from '../types/order'

export const getItemUnitPrice = (item: Pick<OrderItem, 'price' | 'modifiers'>) =>
  item.price + (item.modifiers?.reduce((s, m) => s + m.priceDelta, 0) ?? 0)
