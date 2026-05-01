import type { GroupSlotEntry } from '@fastio/shared'

export type EditorService = {
  _key: string
  serviceId: string
  serviceName: string
  durationMinutes: number
  price: number
  preferredResourceId: string | null
  appointmentId: string | null
  pendingRemove: boolean
}

export type EditorState = {
  customerName: string
  customerPhone: string
  customerEmail: string
  notes: string
  branchId: string | null
  date: string | null
  services: EditorService[]
  selectedSlotEntry: GroupSlotEntry | null
}

export type EditorSnapshot = {
  customerName: string
  customerPhone: string
  customerEmail: string
  notes: string
  branchId: string | null
  date: string | null
  servicesKey: string
}
