export type OrderDeliveryType = 'delivery' | 'pickup'

export type OrderStatusGroup = 'new' | 'in_progress' | 'completed' | 'cancelled'

export type OrderStatus = {
  id: string
  tenantId: string
  name: string
  groupType: OrderStatusGroup
  position: number
  quickActions: string[]
}

export type OrderStatusData = Partial<Pick<OrderStatus, 'name' | 'groupType' | 'quickActions'>>

export type OrderItem = {
  dishId: string
  dishName: string
  categoryName?: string
  price: number
  quantity: number
  removedIngredients: string[]
}

export type OrderCustomer = {
  name: string
  phone: string
}

export type OrderNote = {
  id: string
  orderId: string
  tenantId: string
  authorId: string
  authorName: string
  authorRole: string
  content: string
  createdAt: string
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
  status: string
  paymentType: 'cash' | 'card' | 'online'
  branchId: string | null
  createdAt: string
}
