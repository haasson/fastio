export type BookingMode = 'fixed' | 'open_ended'

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
  duration: number   // минуты — для open_ended трактуется как минимальное окно
  photos: string[]
  tags: string[]
  isBookable: boolean
  bookingMode: BookingMode
  allowResourceChoice: boolean
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** Услуга с явно подгруженным списком филиалов (через `service_branches`). */
export type ServiceWithBranchIds = Service & {
  /** Пусто = доступна во всех филиалах. */
  branchIds: string[]
}

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
  allowResourceChoice: boolean
  branchIds: string[]
  active: boolean
  sortOrder: number
}
