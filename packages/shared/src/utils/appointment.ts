import type {
  Resource, ResourceType,
  ResourceSchedule, ResourceDisabledSlot, ResourceDateOverride, ResourceDateDisabledSlot,
  ResourceUnavailability, ResourceUnavailabilityReason,
  AppointmentSettings, StaffNameFormat,
  Appointment, AppointmentStatus, ResourceAssignedBy,
} from '../types/appointment'
import type { Visit, VisitStatus } from '../types/visit'
import type { AppointmentRequestService } from '../types/appointmentRequest'
import type { BookingMode } from '../types/service'

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

export const mapResourceUnavailability = (raw: Record<string, unknown>): ResourceUnavailability => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  resourceId: raw.resource_id as string,
  dateFrom: raw.date_from as string,
  dateTo: raw.date_to as string,
  reason: raw.reason as ResourceUnavailabilityReason,
  notes: (raw.notes as string | null) ?? null,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
})

// Метки причин отсутствия — единая правда для UI (drawer мастера, календарь
// расписания, статус-tooltip). Если появится новое значение в enum — менять
// здесь и в CHECK constraint миграции 254 одновременно.
export const RESOURCE_UNAVAILABILITY_REASON_LABELS: Record<ResourceUnavailabilityReason, string> = {
  vacation: 'Отпуск',
  sick_leave: 'Больничный',
  training: 'Обучение',
  other: 'Отсутствие',
}

export const RESOURCE_UNAVAILABILITY_REASON_OPTIONS: Array<{ label: string; value: ResourceUnavailabilityReason }> = [
  { label: RESOURCE_UNAVAILABILITY_REASON_LABELS.vacation, value: 'vacation' },
  { label: RESOURCE_UNAVAILABILITY_REASON_LABELS.sick_leave, value: 'sick_leave' },
  { label: RESOURCE_UNAVAILABILITY_REASON_LABELS.training, value: 'training' },
  { label: 'Другое', value: 'other' },
]

// Единая правда дефолтов AppointmentSettings — admin/storefront/маппер должны
// использовать ОДНИ И ТЕ ЖЕ значения, иначе:
// - storefront показывает один набор слотов, admin создаёт записи по-другому;
// - в `mapAppointmentSettings` падает поле NULL из БД (не было в DEFAULT) →
//   рантайм-undefined в типе boolean/number;
// - новые тенанты без строки в `appointment_settings` ловят `as string`-каст
//   и крашат UI.
//
// Поля без дефолта (id/tenantId/createdAt/updatedAt) задаёт БД при создании.
export const DEFAULT_APPOINTMENT_SETTINGS: Omit<AppointmentSettings, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> = {
  resourceLabel: 'Исполнитель',
  resourceMode: 'staff',
  staffNameFormat: 'full_name',
  autoConfirm: false,
  bookingHorizonDays: 30,
  slotStepMinutes: 30,
  allowClientCancellation: true,
  allowClientReschedule: false,
  cancellationDeadlineHours: 2,
  defaultIsBookable: true,
  defaultBookingMode: 'fixed',
  defaultAllowResourceChoice: true,
  defaultMaxDuration: 180,
}

export const mapAppointmentSettings = (raw: Record<string, unknown>): AppointmentSettings => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  resourceLabel: (raw.resource_label as string | null) ?? DEFAULT_APPOINTMENT_SETTINGS.resourceLabel,
  resourceMode: (raw.resource_mode as AppointmentSettings['resourceMode'] | null) ?? DEFAULT_APPOINTMENT_SETTINGS.resourceMode,
  staffNameFormat: (raw.staff_name_format as StaffNameFormat | null) ?? DEFAULT_APPOINTMENT_SETTINGS.staffNameFormat,
  autoConfirm: (raw.auto_confirm as boolean | null) ?? DEFAULT_APPOINTMENT_SETTINGS.autoConfirm,
  bookingHorizonDays: (raw.booking_horizon_days as number | null) ?? DEFAULT_APPOINTMENT_SETTINGS.bookingHorizonDays,
  slotStepMinutes: (raw.slot_step_minutes as number | null) ?? DEFAULT_APPOINTMENT_SETTINGS.slotStepMinutes,
  allowClientCancellation: (raw.allow_client_cancellation as boolean | null) ?? DEFAULT_APPOINTMENT_SETTINGS.allowClientCancellation,
  allowClientReschedule: (raw.allow_client_reschedule as boolean | null) ?? DEFAULT_APPOINTMENT_SETTINGS.allowClientReschedule,
  cancellationDeadlineHours: (raw.cancellation_deadline_hours as number | null) ?? DEFAULT_APPOINTMENT_SETTINGS.cancellationDeadlineHours,
  defaultIsBookable: (raw.default_is_bookable as boolean | null) ?? DEFAULT_APPOINTMENT_SETTINGS.defaultIsBookable,
  defaultBookingMode: (raw.default_booking_mode as AppointmentSettings['defaultBookingMode'] | null) ?? DEFAULT_APPOINTMENT_SETTINGS.defaultBookingMode,
  defaultAllowResourceChoice: (raw.default_allow_resource_choice as boolean | null) ?? DEFAULT_APPOINTMENT_SETTINGS.defaultAllowResourceChoice,
  defaultMaxDuration: (raw.default_max_duration as number | null) ?? DEFAULT_APPOINTMENT_SETTINGS.defaultMaxDuration,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
})

export const mapAppointment = (raw: Record<string, unknown>): Appointment => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  branchId: raw.branch_id as string | null,
  groupId: (raw.group_id as string | null) ?? null,
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
  bookingMode: ((raw.booking_mode as string | undefined) ?? 'fixed') as BookingMode,
  status: raw.status as AppointmentStatus,
  resourceAssignedBy: (raw.resource_assigned_by as ResourceAssignedBy | null) ?? null,
  notes: raw.notes as string | null,
  cancelReason: raw.cancel_reason as string | null,
  cancelledBy: raw.cancelled_by as string | null,
  cancelledAt: raw.cancelled_at as string | null,
  confirmedAt: raw.confirmed_at as string | null,
  confirmedBy: raw.confirmed_by as string | null,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
})

export const mapVisit = (raw: Record<string, unknown>): Visit => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  branchId: raw.branch_id as string | null,
  customerId: (raw.customer_id as string | null) ?? null,
  customerName: raw.customer_name as string,
  customerPhone: raw.customer_phone as string,
  customerEmail: (raw.customer_email as string | null) ?? null,
  notes: raw.notes as string | null,
  source: raw.source as Visit['source'],
  status: ((raw.status as VisitStatus | undefined) ?? 'active'),
  businessDate: (raw.business_date as string | null) ?? null,
  requestedServices: Array.isArray(raw.requested_services)
    ? (raw.requested_services as Record<string, unknown>[]).map(mapAppointmentRequestService)
    : null,
  processedBy: (raw.processed_by as string | null) ?? null,
  processedAt: (raw.processed_at as string | null) ?? null,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
})

export const mapAppointmentRequestService = (raw: Record<string, unknown>): AppointmentRequestService => ({
  serviceId: raw.service_id as string,
  serviceName: raw.service_name as string,
  preferredResourceId: (raw.preferred_resource_id as string | null) ?? null,
  durationMinutes: raw.duration_minutes as number,
  price: raw.price as number,
})

/**
 * Форматирует имя сотрудника по выбранному формату приватности.
 * Используется на витрине, чтобы клиент видел не полные ФИО, а краткую форму.
 *
 * - 'first_name' → "Анна Краснова" → "Анна"
 * - 'first_name_last_initial' → "Анна Краснова" → "Анна К."
 * - 'full_name' → как есть
 *
 * Особенности:
 * - двойные пробелы в имени ("Анна  К.") схлопываются — иначе `parts[1] = ''`
 *   и доступ к нулевому индексу падает.
 */
export const formatStaffName = (name: string, format: StaffNameFormat): string => {
  if (format === 'first_name') return name.split(' ')[0] ?? name
  if (format === 'first_name_last_initial') {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) {
      const initial = parts[1]?.[0] ?? ''
      return initial ? `${parts[0]} ${initial}.` : (parts[0] ?? name)
    }
    return name
  }
  return name
}
