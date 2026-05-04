import type { TenantNotifications, WorkingHoursSchedule } from './tenant'
import type { DadataAddressData } from '../composables/useDadataSuggestions'

/**
 * Структурный адрес филиала, как пришёл из DaData. Храним весь объект `data`
 * целиком (jsonb) — Record<string, unknown> для незакрытого хвоста полей.
 * Используется во фронте через formatBranchAddressShort() и в будущем — для
 * фильтров «филиалы в Москве», метро рядом с самовывозом и т.д.
 */
export type BranchAddressData = DadataAddressData & Record<string, unknown> & {
  value: string
}

export type Branch = {
  id: string
  tenantId: string
  name: string
  address: string
  addressData: BranchAddressData
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
  addressData: BranchAddressData
  phone: string | null
  workingHoursSchedule: WorkingHoursSchedule | null
}

