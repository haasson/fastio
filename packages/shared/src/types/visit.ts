import type { AppointmentRequestService } from './appointmentRequest'

export type AppointmentSource = 'storefront' | 'admin' | 'request'

export const APPOINTMENT_SOURCES = ['storefront', 'admin', 'request'] as const

export const APPOINTMENT_SOURCE_LABELS: Record<AppointmentSource, string> = {
  storefront: '🌐 Витрина',
  admin: '👤 Администратор',
  request: '✉️ Заявка',
}

// Стадия визита:
//   'request'   — клиент оставил заявку без выбора слотов (старая appointment_requests до 230)
//   'active'    — обычный оформленный визит с appointments и business_date
//   'cancelled' — визит отменён (включая отклонённые заявки)
export type VisitStatus = 'request' | 'active' | 'cancelled'

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  request: 'Заявка',
  active: 'Визит',
  cancelled: 'Отменён',
}

export type Visit = {
  id: string
  tenantId: string
  branchId: string | null
  customerId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  notes: string | null
  source: AppointmentSource
  status: VisitStatus
  // YYYY-MM-DD — бизнес-день визита (не календарный, см. compute_business_date).
  // Все appointments визита обязаны попадать в эту дату. Для status='request'
  // ещё не задан (клиент не выбрал день).
  businessDate: string | null
  // Список «хотелок» для request-стадии. Для active/cancelled — null
  // (реальные услуги в appointments).
  requestedServices: AppointmentRequestService[] | null
  // Кто и когда оформил/отклонил заявку.
  processedBy: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
}
