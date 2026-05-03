export type BookingMode = 'fixed' | 'variable'

/**
 * Услуга. `branchIds` тут НЕТ — связка services↔branches хранится в junction
 * `service_branches` и грузится отдельно (см. `ServiceWithBranchIds` ниже,
 * `services.list` в admin api, `services-catalog` в storefront server).
 *
 * Раньше был `branchIds: string[]`, но `mapService` всегда возвращал `[]`,
 * а реальные данные подмешивались только в одном месте (admin api wrapper)
 * — это превращалось в type lie и ломало realtime-маппер.
 */
export type Service = {
  id: string
  tenantId: string
  categoryId: string | null
  name: string
  description: string
  price: number
  duration: number
  photos: string[]
  tags: string[]
  isBookable: boolean
  bookingMode: BookingMode
  maxDuration: number | null  // только для variable; null = берётся из appointment_settings
  allowResourceChoice: boolean
  active: boolean
  sortOrder: number
  longDescription: string | null
  createdAt: string
  updatedAt: string
}

/** Услуга с явно подгруженным списком филиалов (через `service_branches`). */
export type ServiceWithBranchIds = Service & {
  /** Пусто = доступна во всех филиалах. */
  branchIds: string[]
}

/** Карточка услуги для витрины — публичные поля без admin-специфики. */
export type ServiceCard = Pick<ServiceWithBranchIds,
  | 'id' | 'tenantId' | 'categoryId' | 'name' | 'description'
  | 'price' | 'duration' | 'photos' | 'tags'
  | 'isBookable' | 'bookingMode' | 'maxDuration' | 'allowResourceChoice'
  | 'branchIds'
>

export type ServiceFormData = {
  categoryId: string | null
  name: string
  description: string
  price: number
  duration: number
  photos: string[]
  tags: string[]
  isBookable: boolean
  bookingMode: BookingMode
  maxDuration: number | null
  allowResourceChoice: boolean
  branchIds: string[]
  active: boolean
  sortOrder: number
  longDescription: string | null
}
