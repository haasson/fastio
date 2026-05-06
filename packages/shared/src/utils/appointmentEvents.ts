import type { AppointmentEvent, AppointmentEventType, AppointmentStatus } from '../types/appointment'

export const mapAppointmentEvent = (raw: Record<string, unknown>): AppointmentEvent => ({
  id: raw.id as string,
  appointmentId: raw.appointment_id as string,
  tenantId: raw.tenant_id as string,
  actorId: (raw.actor_id as string | null) ?? null,
  actorName: (raw.actor_name as string | null) ?? null,
  actorRole: (raw.actor_role as string | null) ?? null,
  eventType: raw.event_type as AppointmentEventType,
  meta: (raw.meta as Record<string, unknown> | null) ?? {},
  createdAt: raw.created_at as string,
})

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  done: 'Завершена',
  cancelled: 'Отменена',
}

export const APPOINTMENT_EVENT_FIELD_LABELS: Record<string, string> = {
  service_id: 'Услуга',
  resource_id: 'Исполнитель',
  customer_name: 'Имя клиента',
  customer_phone: 'Телефон',
  notes: 'Примечание',
  starts_at: 'Начало',
  ends_at: 'Окончание',
}

export type AppointmentFieldChange = {
  label: string
  oldFormatted: string
  newFormatted: string
}

export function formatAppointmentEventText(event: AppointmentEvent): string {
  if (event.eventType === 'appointment_created') {
    const base = event.meta.source === 'storefront' ? 'Создана клиентом через сайт' : 'Запись создана'
    return event.meta.service_name ? `${base}: ${event.meta.service_name}` : base
  }
  if (event.eventType === 'status_changed') {
    const from = APPOINTMENT_STATUS_LABELS[event.meta.from as AppointmentStatus] ?? '?'
    const to = APPOINTMENT_STATUS_LABELS[event.meta.to as AppointmentStatus] ?? '?'
    return `Статус: ${from} → ${to}`
  }
  if (event.eventType === 'extended') return `Продлена на ${event.meta.minutes ?? '?'} мин`
  if (event.eventType === 'closed_now') return 'Закрыта сейчас'
  return event.eventType
}

export function formatAppointmentFieldValue(
  field: string,
  value: unknown,
  formatDate: (iso: string) => string,
): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'starts_at' || field === 'ends_at') return formatDate(String(value))
  return String(value)
}

export function extractAppointmentFieldChanges(
  event: AppointmentEvent,
  formatDate: (iso: string) => string,
): AppointmentFieldChange[] {
  const changes = Array.isArray(event.meta.changes)
    ? (event.meta.changes as Array<{ field: string; old_value: unknown; new_value: unknown }>)
    : []
  return changes.map((c) => ({
    label: APPOINTMENT_EVENT_FIELD_LABELS[c.field] ?? c.field,
    oldFormatted: formatAppointmentFieldValue(c.field, c.old_value, formatDate),
    newFormatted: formatAppointmentFieldValue(c.field, c.new_value, formatDate),
  }))
}

export function getAppointmentEventActorFallback(event: AppointmentEvent): string {
  if (event.eventType === 'appointment_created' && event.meta.source === 'storefront') return 'Клиент'
  return 'Система'
}
