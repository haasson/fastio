import type { TenantNotifications } from './tenant'

export type Branch = {
  id: string
  tenantId: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  workingHours: string | null
  deliveryMinOrder: number | null
  deliveryFee: number | null
  notifications: TenantNotifications | null
  createdAt: string
  updatedAt: string
}

export type BranchFormData = Omit<Branch, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>

export type DishBranchPrice = {
  dishId: string
  branchId: string
  price: number
}
