export type OrderDeliveryType = 'delivery' | 'pickup'

export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'cooking'
  | 'ready'
  | 'delivering'
  | 'completed'
  | 'cancelled'

export type OrderItem = {
  dishId: string
  dishName: string
  price: number
  quantity: number
  removedIngredients: string[]
}

export type OrderCustomer = {
  name: string
  phone: string
}

export type Order = {
  id: string
  tenantId: string
  customer: OrderCustomer
  items: OrderItem[]
  deliveryType: OrderDeliveryType
  address: string | null
  comment: string | null
  promoCode: string | null
  discountAmount: number
  subtotal: number
  deliveryFee: number
  total: number
  status: OrderStatus
  paymentType: 'cash' | 'card' | 'online'
  createdAt: string
}
