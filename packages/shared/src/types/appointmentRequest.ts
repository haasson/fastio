import type { StatusTagType } from './appointmentGroup'

export type AppointmentRequestStatus = 'new' | 'in_progress' | 'converted' | 'declined'

export const APPOINTMENT_REQUEST_STATUSES = [
  'new',
  'in_progress',
  'converted',
  'declined',
] as const

export const APPOINTMENT_REQUEST_STATUS_LABELS: Record<AppointmentRequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  converted: 'Оформлена',
  declined: 'Отклонена',
}

export const APPOINTMENT_REQUEST_STATUS_TAG_TYPES: Record<AppointmentRequestStatus, StatusTagType> = {
  new: 'warning',
  in_progress: 'primary',
  converted: 'success',
  declined: 'error',
}

export type AppointmentRequestService = {
  serviceId: string
  serviceName: string
  preferredResourceId: string | null
  durationMinutes: number
  price: number
}

export type AppointmentRequest = {
  id: string
  tenantId: string
  branchId: string | null
  customerId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  notes: string | null
  services: AppointmentRequestService[]
  status: AppointmentRequestStatus
  convertedGroupId: string | null
  processedBy: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
}
