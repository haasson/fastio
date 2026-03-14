import type { OrderItem } from '../types/order'

export const getItemUnitPrice = (item: Pick<OrderItem, 'price' | 'modifiers' | 'addons'>) =>
  item.price
  + (item.modifiers?.reduce((s, m) => s + m.priceDelta, 0) ?? 0)
  + (item.addons?.reduce((s, a) => s + a.price, 0) ?? 0)
