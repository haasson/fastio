import type {
  Appointment, AppointmentGroup, AppointmentRequest,
} from '@fastio/shared'
import { utcIsoToLocalDateTime } from '@fastio/shared'
import type { EditorService, EditorState } from '~/components/appointments/types'

/** Уникальный ключ для reactive list (трекинг строк услуг при ре-сортировке/удалении). */
export const newKey = (): string => `svc-${crypto.randomUUID()}`

/** Стабильный ключ состава активных услуг для сравнения снапшотов. */
export const buildServicesKey = (services: EditorService[]): string => JSON.stringify(
  services
    .filter((s) => !s.pendingRemove)
    .map((s) => ({ serviceId: s.serviceId, preferredResourceId: s.preferredResourceId ?? null })),
)

export const durationFromAppointment = (a: Appointment): number => Math.max(
  0,
  Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000),
)

/**
 * Заполняет state из существующей группы (edit-mode). Берёт первую запись для
 * определения даты, отменённые записи отбрасывает. ServiceId для записей с
 * удалённой услугой → пустая строка (UI покажет «—»).
 */
export const prefillFromGroup = (
  state: EditorState,
  group: AppointmentGroup,
  appointments: Appointment[],
  tz: string,
): void => {
  state.customerName = group.customerName
  state.customerPhone = group.customerPhone
  state.customerEmail = group.customerEmail ?? ''
  state.notes = group.notes ?? ''
  state.branchId = group.branchId

  if (appointments.length > 0) {
    const { dateStr } = utcIsoToLocalDateTime(appointments[0].startsAt, tz)

    state.date = dateStr
  }

  state.services = appointments
    .filter((a) => a.status !== 'cancelled')
    .map((a) => ({
      _key: newKey(),
      serviceId: a.serviceId ?? '',
      serviceName: a.serviceName,
      durationMinutes: durationFromAppointment(a),
      price: a.servicePrice,
      preferredResourceId: a.resourceId,
      appointmentId: a.id,
      pendingRemove: false,
    }))
}

/**
 * Заполняет state из заявки (create-mode при конвертации заявки в запись).
 * Услуги переносятся в исходном порядке, preferredResourceId сохраняется как есть.
 */
export const prefillFromRequest = (state: EditorState, req: AppointmentRequest): void => {
  state.customerName = req.customerName
  state.customerPhone = req.customerPhone
  state.customerEmail = req.customerEmail ?? ''
  state.notes = req.notes ?? ''
  state.branchId = req.branchId
  state.services = req.services.map((s) => ({
    _key: newKey(),
    serviceId: s.serviceId,
    serviceName: s.serviceName,
    durationMinutes: s.durationMinutes,
    price: s.price,
    preferredResourceId: s.preferredResourceId,
    appointmentId: null,
    pendingRemove: false,
  }))
}
