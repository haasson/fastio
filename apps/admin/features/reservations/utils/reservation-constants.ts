import type { ReservationStatus } from '@fastio/shared'
import { RESERVATION_STATUS_LABELS } from '@fastio/shared'

export type ReservationTagType = 'default' | 'primary' | 'success' | 'warning' | 'error'

// Reexport чтобы существующие импорты из admin продолжали работать.
export { RESERVATION_STATUS_LABELS }

export const RESERVATION_STATUS_TYPES: Record<ReservationStatus, ReservationTagType> = {
  pending: 'warning',
  confirmed: 'primary',
  seated: 'success',
  completed: 'default',
  cancelled: 'error',
  no_show: 'error',
}

export const RESERVATION_STATUS_FILTER_OPTIONS = (
  ['pending', 'confirmed', 'seated', 'cancelled', 'no_show'] as ReservationStatus[]
).map((s) => ({
  label: RESERVATION_STATUS_LABELS[s],
  value: s,
}))

export const RESERVATION_ACTIVE_STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'seated']

export const RESERVATION_ARCHIVE_STATUSES: ReservationStatus[] = ['completed', 'cancelled', 'no_show']

export const RESERVATION_ARCHIVE_STATUS_OPTIONS = RESERVATION_ARCHIVE_STATUSES.map((s) => ({
  label: RESERVATION_STATUS_LABELS[s],
  value: s,
}))
