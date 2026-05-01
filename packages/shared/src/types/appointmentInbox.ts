import type { AppointmentStatus } from './appointment'
import type { Visit } from './visit'

// Агрегат статуса визита для UI инбокса.
//   request   — стадия «заявка», услуг ещё нет (только requested_services)
//   pending   — есть хотя бы одна услуга со статусом 'new', визит требует обработки
//   confirmed — все non-cancelled услуги подтверждены, никто ещё не done
//   done      — все non-cancelled услуги завершены
//   cancelled — все услуги отменены ИЛИ визит как целое status='cancelled'
//   mixed     — confirmed/done вперемешку с cancelled
export type VisitAggregateStatus = 'request' | 'pending' | 'confirmed' | 'done' | 'cancelled' | 'mixed'

export const VISIT_AGGREGATE_STATUS_LABELS: Record<VisitAggregateStatus, string> = {
  request: 'Заявка',
  pending: 'Требует обработки',
  confirmed: 'Подтверждена',
  done: 'Завершена',
  cancelled: 'Отменена',
  mixed: 'Частично',
}

export type VisitAggregateStatusTagType = 'default' | 'primary' | 'success' | 'warning' | 'error'

export const VISIT_AGGREGATE_STATUS_TAG_TYPES: Record<VisitAggregateStatus, VisitAggregateStatusTagType> = {
  request: 'primary',
  pending: 'warning',
  confirmed: 'success',
  done: 'default',
  cancelled: 'error',
  mixed: 'primary',
}

export type VisitListRow = Visit & {
  kind: 'visit'
  servicesList: string[]
  firstStartsAt: string | null
  totalDurationMinutes: number
  aggregateStatus: VisitAggregateStatus
  statusCounts: Partial<Record<AppointmentStatus, number>>
}

// После 230 заявка = визит со status='request', отдельной строки больше нет.
export type InboxRow = VisitListRow

export type InboxFilter = 'new' | 'today' | 'week' | 'archive' | 'all'
