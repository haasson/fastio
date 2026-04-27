import type { OrderItemModifier } from './modifier'

export type OrderItemAddon = {
  addonId: string
  addonName: string
  price: number
}

export type OrderDeliveryType = 'delivery' | 'pickup' | 'dine_in'

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

export type OrderItemStatus = 'pending' | 'confirmed'

export type OrderItem = {
  id?: string
  orderId?: string
  dishId: string | null
  comboId: string | null
  dishName: string
  categoryName: string | null
  price: number
  quantity: number
  removedIngredients: string[]
  modifiers: OrderItemModifier[]
  addons: OrderItemAddon[]
  customizable?: boolean
  sortOrder?: number
  completedAt: string | null
  comboItems: { dishName: string }[] | null
  addedBy: string | null
  confirmedBy: string | null
  status: OrderItemStatus
}

export type { OrderItemModifier } from './modifier'

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

export type OrderEventType = 'order_created' | 'status_changed' | 'items_updated' | 'field_updated' | 'kitchen_claimed' | 'kitchen_completed' | 'kitchen_returned'

export type OrderEvent = {
  id: string
  orderId: string
  tenantId: string
  actorId: string | null
  actorName: string | null
  actorRole: string | null
  eventType: OrderEventType
  meta: Record<string, unknown>
  createdAt: string
}

export type Order = {
  id: string
  tenantId: string
  customerName: string | null
  customerPhone: string
  customerEmail: string | null
  items: OrderItem[]
  deliveryType: OrderDeliveryType
  address: string | null
  entrance: string | null
  floor: string | null
  apartment: string | null
  intercom: string | null
  deliveryLat: number | null
  deliveryLon: number | null
  comment: string | null
  promoCode: string | null
  promotionId: string | null
  discountAmount: number
  subtotal: number
  deliveryFee: number
  total: number
  status: string
  statusGroup: OrderStatusGroup | null
  statusName: string | null
  paymentType: 'cash' | 'card' | 'online'
  needsChange: boolean
  changeFrom: number | null
  branchId: string | null
  branchAddress: string | null
  deliveryZoneId: string | null
  tableId: string | null
  tableName: string | null
  orderNumber: string | null
  acceptedBy: string | null
  createdAt: string
  updatedAt: string
  kitchenQueuedAt: string | null
  kitchenCompletedAt: string | null
  kitchenLeadMinutes: number | null
  scheduledAt: string | null
  visitedStatuses: string[]
}
