import type {
  Resource, ResourceType,
  ResourceSchedule, ResourceDisabledSlot, ResourceDateOverride, ResourceDateDisabledSlot,
  AppointmentSettings, StaffNameFormat,
  Appointment, AppointmentStatus,
} from '../types/appointment'

export const mapResource = (raw: Record<string, unknown>): Resource => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  name: raw.name as string,
  type: raw.type as ResourceType,
  memberId: raw.member_id as string | null,
  // Защита от capacity=0 в БД — иначе mergeResourceSlots падает с делением на ноль.
  capacity: Math.max(1, (raw.capacity as number) ?? 1),
  isActive: raw.is_active as boolean,
  sortOrder: raw.sort_order as number,
  appliedTemplateId: (raw.applied_template_id as string | null) ?? null,
  cycleStartDate: (raw.cycle_start_date as string | null) ?? null,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
})

export const mapResourceSchedule = (raw: Record<string, unknown>): ResourceSchedule => ({
  id: raw.id as string,
  resourceId: raw.resource_id as string,
  dayOfWeek: raw.day_of_week as number,
  isWorking: raw.is_working as boolean,
  openTime: raw.open_time ? (raw.open_time as string).slice(0, 5) : null,
  closeTime: raw.close_time ? (raw.close_time as string).slice(0, 5) : null,
})

export const mapResourceDisabledSlot = (raw: Record<string, unknown>): ResourceDisabledSlot => ({
  id: raw.id as string,
  resourceId: raw.resource_id as string,
  dayOfWeek: raw.day_of_week as number,
  slotTime: (raw.slot_time as string).slice(0, 5),
})

export const mapResourceDateOverride = (raw: Record<string, unknown>): ResourceDateOverride => ({
  id: raw.id as string,
  resourceId: raw.resource_id as string,
  date: raw.date as string,
  isWorking: raw.is_working as boolean,
  openTime: raw.open_time ? (raw.open_time as string).slice(0, 5) : null,
  closeTime: raw.close_time ? (raw.close_time as string).slice(0, 5) : null,
})

export const mapResourceDateDisabledSlot = (raw: Record<string, unknown>): ResourceDateDisabledSlot => ({
  id: raw.id as string,
  resourceId: raw.resource_id as string,
  date: raw.date as string,
  slotTime: (raw.slot_time as string).slice(0, 5),
})

export const mapAppointmentSettings = (raw: Record<string, unknown>): AppointmentSettings => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  resourceLabel: raw.resource_label as string,
  resourceMode: (raw.resource_mode as AppointmentSettings['resourceMode']) ?? 'staff',
  staffNameFormat: raw.staff_name_format as StaffNameFormat,
  autoConfirm: raw.auto_confirm as boolean,
  bookingHorizonDays: raw.booking_horizon_days as number,
  slotStepMinutes: raw.slot_step_minutes as number,
  allowClientCancellation: raw.allow_client_cancellation as boolean,
  allowClientReschedule: (raw.allow_client_reschedule as boolean | undefined) ?? false,
  cancellationDeadlineHours: raw.cancellation_deadline_hours as number,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
})

export const mapAppointment = (raw: Record<string, unknown>): Appointment => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  branchId: raw.branch_id as string | null,
  serviceId: (raw.service_id as string | null) ?? null,
  serviceName: (raw.service_name as string) ?? '',
  servicePrice: (raw.service_price as number) ?? 0,
  resourceId: raw.resource_id as string | null,
  userId: raw.user_id as string | null,
  customerId: (raw.customer_id as string | null) ?? null,
  customerName: raw.customer_name as string,
  customerPhone: raw.customer_phone as string,
  startsAt: raw.starts_at as string,
  endsAt: raw.ends_at as string,
  actualEndsAt: (raw.actual_ends_at as string | null) ?? null,
  status: raw.status as AppointmentStatus,
  notes: raw.notes as string | null,
  cancelReason: raw.cancel_reason as string | null,
  cancelledBy: raw.cancelled_by as string | null,
  cancelledAt: raw.cancelled_at as string | null,
  confirmedAt: raw.confirmed_at as string | null,
  confirmedBy: raw.confirmed_by as string | null,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
})
