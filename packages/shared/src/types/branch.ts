import type { TenantNotifications, WorkingHoursSchedule } from './tenant'

export type Branch = {
  id: string
  tenantId: string
  name: string
  address: string
  phone: string | null
  isActive: boolean
  workingHoursSchedule: WorkingHoursSchedule | null
  deliveryMinOrder: number | null
  deliveryFee: number | null
  notifications: TenantNotifications | null
  color: string
  latitude: number | null
  longitude: number | null
  orderNumberPrefix: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type BranchFormData = Omit<Branch, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'archivedAt'>

/**
 * Минимальное представление филиала для витрины — то, что отдаёт `/api/branches`.
 * Используется в селекторах самовывоза, branch-picker модалке, корзине и т.д.
 */
export type BranchPublic = {
  id: string
  name: string
  address: string
  phone: string | null
  workingHoursSchedule: import('./tenant').WorkingHoursSchedule | null
}

