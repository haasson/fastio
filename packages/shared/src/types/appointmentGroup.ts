export type AppointmentGroupStatus = 'new' | 'confirmed' | 'partially_cancelled' | 'cancelled' | 'done'

export const APPOINTMENT_GROUP_STATUSES = [
  'new',
  'confirmed',
  'partially_cancelled',
  'cancelled',
  'done',
] as const

export const APPOINTMENT_GROUP_STATUS_LABELS: Record<AppointmentGroupStatus, string> = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  partially_cancelled: 'Частично отменена',
  cancelled: 'Отменена',
  done: 'Завершена',
}

export type StatusTagType = 'default' | 'primary' | 'success' | 'warning' | 'error'

export const APPOINTMENT_GROUP_STATUS_TAG_TYPES: Record<AppointmentGroupStatus, StatusTagType> = {
  new: 'warning',
  confirmed: 'success',
  partially_cancelled: 'warning',
  cancelled: 'error',
  done: 'default',
}

export type AppointmentSource = 'storefront' | 'admin' | 'request'

export const APPOINTMENT_SOURCES = ['storefront', 'admin', 'request'] as const

export const APPOINTMENT_SOURCE_LABELS: Record<AppointmentSource, string> = {
  storefront: '🌐 Витрина',
  admin: '👤 Администратор',
  request: '✉️ Заявка',
}

export type AppointmentGroup = {
  id: string
  tenantId: string
  branchId: string | null
  customerId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  notes: string | null
  status: AppointmentGroupStatus
  totalPrice: number | null
  totalDurationMinutes: number | null
  source: AppointmentSource
  requestId: string | null
  createdAt: string
  updatedAt: string
}
