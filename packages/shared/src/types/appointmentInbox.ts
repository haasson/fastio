import type { AppointmentGroup } from './appointmentGroup'
import type { AppointmentRequest } from './appointmentRequest'

export type GroupListRow = AppointmentGroup & {
  kind: 'group'
  servicesList: string[]
  firstStartsAt: string | null
}

export type RequestListRow = AppointmentRequest & {
  kind: 'request'
}

export type InboxRow = GroupListRow | RequestListRow

export type InboxFilter = 'new' | 'today' | 'week' | 'archive' | 'all'
