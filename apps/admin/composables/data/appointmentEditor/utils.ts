import type {
  Appointment, AppointmentStatus, Visit, VisitStatus,
} from '@fastio/shared'
import { utcIsoToLocalDateTime } from '@fastio/shared'
import type { EditorService, EditorState } from '~/components/appointments/types'

/** Уникальный ключ для reactive list (трекинг строк услуг при ре-сортировке/удалении). */
export const newKey = (): string => `svc-${crypto.randomUUID()}`

/** Стабильный ключ состава активных услуг для сравнения снапшотов.
 *  Учитывает выбранный слот и мастера — изменение любого из них делает форму dirty. */
export const buildServicesKey = (services: EditorService[]): string => JSON.stringify(
  services
    .filter((s) => !s.pendingRemove)
    .map((s) => ({
      serviceId: s.serviceId,
      preferredResourceId: s.preferredResourceId ?? null,
      currentResourceId: s.currentResourceId ?? null,
      currentStartTime: s.currentStartTime ?? null,
    })),
)

export const durationFromAppointment = (a: Appointment): number => Math.max(
  0,
  Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000),
)

/**
 * Статус для новой услуги, добавляемой в существующий визит. Услуги внутри
 * визита семантически разделяют его статус (отдельных статусов у appointment
 * как сущности у нас нет — поле status просто дублирует статус визита).
 *
 * - active-визит уже подтверждён → новая услуга сразу confirmed, иначе
 *   получился бы «полу-подтверждённый» микс old=confirmed + new=new и менеджеру
 *   снова пришлось бы жать «Подтвердить визит»
 * - request-визит ещё не подтверждён → новая услуга new
 * - cancelled-визит сюда не доходит: форма редактирования read-only.
 */
export const inheritAppointmentStatus = (
  visitStatus: VisitStatus,
): Extract<AppointmentStatus, 'new' | 'confirmed'> => visitStatus === 'active' ? 'confirmed' : 'new'

/**
 * Заполняет state из существующего визита (edit-mode). Берёт первую запись для
 * определения даты, отменённые записи отбрасывает. ServiceId для записей с
 * удалённой услугой → пустая строка (UI покажет «—»).
 */
export const prefillFromVisit = (
  state: EditorState,
  visit: Visit,
  appointments: Appointment[],
  tz: string,
): void => {
  state.customerName = visit.customerName
  state.customerPhone = visit.customerPhone
  state.notes = visit.notes ?? ''
  state.branchId = visit.branchId

  if (appointments.length > 0) {
    const { dateStr } = utcIsoToLocalDateTime(appointments[0].startsAt, tz)

    state.date = dateStr
  }

  state.services = appointments
    .filter((a) => a.status !== 'cancelled')
    .map((a) => {
      const start = utcIsoToLocalDateTime(a.startsAt, tz)
      const end = utcIsoToLocalDateTime(a.endsAt, tz)

      // Если мастер был назначен автоподбором — клиенту был безразличен.
      // При смене даты/слота не считаем его «предпочтительным» (иначе все
      // слоты с другими мастерами стали бы жёлтыми «с заменой»). currentResourceId
      // остаётся реальным, чтобы карточка показала кого назначили.
      const isAutoAssigned = a.resourceAssignedBy === 'auto'

      return {
        _key: newKey(),
        serviceId: a.serviceId ?? '',
        serviceName: a.serviceName,
        durationMinutes: durationFromAppointment(a),
        price: a.servicePrice,
        preferredResourceId: isAutoAssigned ? null : a.resourceId,
        appointmentId: a.id,
        pendingRemove: false,
        currentResourceId: a.resourceId,
        currentStartTime: start.timeStr,
        currentEndTime: end.timeStr,
        originalResourceId: a.resourceId,
        originalStartTime: start.timeStr,
        originalEndTime: end.timeStr,
      }
    })
}

/**
 * Заполняет state для оформления request-визита: метаданные клиента из визита +
 * услуги-черновики из visit.requestedServices. Дата/слоты пустые — менеджер
 * выбирает в редакторе и при save вызывается convert_visit_request.
 */
export const prefillFromRequestVisit = (state: EditorState, visit: Visit): void => {
  state.customerName = visit.customerName
  state.customerPhone = visit.customerPhone
  state.notes = visit.notes ?? ''
  state.branchId = visit.branchId

  state.services = (visit.requestedServices ?? []).map((s) => ({
    _key: newKey(),
    serviceId: s.serviceId,
    serviceName: s.serviceName,
    durationMinutes: s.durationMinutes,
    price: s.price,
    preferredResourceId: s.preferredResourceId,
    appointmentId: null,
    pendingRemove: false,
    currentResourceId: null,
    currentStartTime: null,
    currentEndTime: null,
    originalResourceId: null,
    originalStartTime: null,
    originalEndTime: null,
  }))
}
