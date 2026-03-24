import type { Reservation, ReservationStatus } from '../types/reservation'

export const mapReservation = (raw: Record<string, unknown>): Reservation => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  branchId: raw.branch_id as string | null,
  customerId: raw.customer_id as string | null,
  guestName: raw.guest_name as string,
  guestPhone: raw.guest_phone as string,
  guestEmail: raw.guest_email as string | null,
  guestCount: raw.guest_count as number,
  reservedDate: raw.reserved_date as string,
  reservedTime: (raw.reserved_time as string).slice(0, 5), // "HH:MM:SS" → "HH:MM"
  comment: raw.comment as string | null,
  status: raw.status as ReservationStatus,
  tableId: raw.table_id as string | null,
  tableName: raw.table_name as string | null,
  confirmedBy: raw.confirmed_by as string | null,
  confirmedAt: raw.confirmed_at as string | null,
  seatedAt: raw.seated_at as string | null,
  cancelledAt: raw.cancelled_at as string | null,
  cancelReason: raw.cancel_reason as string | null,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
})
