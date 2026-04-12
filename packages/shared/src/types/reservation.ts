export type ReservationStatus =
  'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'

export type Reservation = {
  id: string
  tenantId: string
  branchId: string | null
  customerId: string | null
  guestName: string
  guestPhone: string
  guestEmail: string | null
  guestCount: number
  reservedDate: string     // "YYYY-MM-DD"
  reservedTime: string     // "HH:MM"
  comment: string | null
  status: ReservationStatus
  tableId: string | null
  tableName: string | null
  confirmedBy: string | null
  confirmedAt: string | null
  seatedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
}

export type ReservationFormData = {
  guestName: string
  guestPhone: string
  guestEmail?: string | null
  guestCount: number
  reservedDate: string
  reservedTime: string
  comment?: string | null
  branchId?: string | null
}

export type ReservationSettings = {
  id: string
  tenantId: string
  enabled: boolean
  slotStep: number
  closeBufferMinutes: number  // last booking N minutes before closing
  maxAdvanceDays: number
  minGuests: number
  maxGuests: number
  autoConfirm: boolean
}

export type ReservationSettingsFormData = Partial<Omit<ReservationSettings, 'id' | 'tenantId'>>
