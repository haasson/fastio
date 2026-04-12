import type { OrderItemModifier } from './modifier'
import type { OrderItemAddon, OrderDeliveryType } from './order'

export type KitchenQueueStatus = 'queued' | 'in_progress' | 'done' | 'served' | 'cancelled'

export type KitchenQueueItem = {
  id: string
  tenantId: string
  orderId: string
  orderNumber: string | null
  orderItemId: string
  dishName: string
  dishId: string | null
  comboId: string | null
  comboName: string | null
  categoryName: string | null
  modifiers: OrderItemModifier[]
  addons: OrderItemAddon[]
  removedIngredients: string[]
  deliveryType: OrderDeliveryType
  status: KitchenQueueStatus
  assignedTo: string | null
  assignedAt: string | null
  completedAt: string | null
  servedAt: string | null
  servedBy: string | null
  dismissedAt: string | null
  skipKitchen: boolean
  createdAt: string
}

export type KitchenConfig = {
  sourceStatusId: string | null
  cookingStatusId: string | null
  completedStatusMap: {
    delivery: string | null
    pickup: string | null
    dine_in: string | null
  }
}
