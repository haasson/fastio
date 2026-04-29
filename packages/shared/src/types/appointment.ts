import type { WorkingHoursSchedule } from './tenant'

export type ResourceType = 'person' | 'object'

export type AppointmentStatus = 'new' | 'confirmed' | 'cancelled' | 'done'

export type StaffNameFormat = 'first_name' | 'first_name_last_initial' | 'full_name'

export type Resource = {
  id: string
  tenantId: string
  name: string
  type: ResourceType
  memberId: string | null   // обязателен для type='person', null для 'object'
  capacity: number          // 1+ параллельных бронирований
  isActive: boolean
  sortOrder: number
  appliedTemplateId: string | null  // ID последнего применённого шаблона графика
  cycleStartDate: string | null     // YYYY-MM-DD; день 1 цикла для shift-шаблона
  createdAt: string
  updatedAt: string
}

// Базовый недельный шаблон расписания ресурса
export type ResourceSchedule = {
  id: string
  resourceId: string
  dayOfWeek: number     // 0=Sun, 1=Mon, ..., 6=Sat
  isWorking: boolean
  openTime: string | null   // "HH:MM" — null если isWorking=false
  closeTime: string | null  // "HH:MM" — null если isWorking=false
}

// Выключенный слот в базовом шаблоне (обед, перерыв)
export type ResourceDisabledSlot = {
  id: string
  resourceId: string
  dayOfWeek: number
  slotTime: string  // "HH:MM"
}

// Переопределение расписания на конкретную дату
export type ResourceDateOverride = {
  id: string
  resourceId: string
  date: string          // "YYYY-MM-DD"
  isWorking: boolean
  openTime: string | null
  closeTime: string | null
}

// Выключенный слот на конкретную дату
export type ResourceDateDisabledSlot = {
  id: string
  resourceId: string
  date: string      // "YYYY-MM-DD"
  slotTime: string  // "HH:MM"
}

export type AppointmentResourceMode = 'staff' | 'objects' | 'both'

export type AppointmentSettings = {
  id: string
  tenantId: string
  resourceLabel: string
  resourceMode: AppointmentResourceMode
  staffNameFormat: StaffNameFormat
  autoConfirm: boolean
  bookingHorizonDays: number
  slotStepMinutes: number
  allowClientCancellation: boolean
  allowClientReschedule: boolean
  cancellationDeadlineHours: number
  createdAt: string
  updatedAt: string
}

export type Appointment = {
  id: string
  tenantId: string
  branchId: string | null
  serviceId: string | null  // null если услуга удалена; см. service_name/service_price
  serviceName: string       // снапшот имени услуги на момент записи
  servicePrice: number      // снапшот цены услуги на момент записи
  resourceId: string | null
  userId: string | null
  customerId: string | null
  customerName: string
  customerPhone: string
  startsAt: string         // UTC ISO timestamp
  endsAt: string           // UTC ISO timestamp — расчётное (starts + duration)
  actualEndsAt: string | null  // фактическое окончание для open_ended
  status: AppointmentStatus
  notes: string | null
  cancelReason: string | null
  cancelledBy: string | null  // 'client' | 'admin'
  cancelledAt: string | null
  confirmedAt: string | null
  confirmedBy: string | null
  createdAt: string
  updatedAt: string
}

export type AppointmentFormData = {
  serviceId: string
  resourceId: string | null
  branchId: string | null
  customerName: string
  customerPhone: string
  startsAt: string  // UTC ISO timestamp
  notes?: string | null
}

// Все данные расписания ресурса для генерации слотов.
// Если schedules пустой и нет override на дату — используется branchSchedule
// (фоллбек "график не задан → как у филиала").
//
// Если задан shiftCycle — для каждой даты слоты вычисляются лениво из
// шаблона по формуле: cycleIndex = ((daysSince(cycleStartDate)) % cycleLength).
// Перекрывает branchSchedule, но dateOverrides и dateDisabledSlots всё ещё
// имеют приоритет (пользовательские исключения остаются жёсткими).
export type ResourceSlotData = {
  schedules: ResourceSchedule[]
  disabledSlots: ResourceDisabledSlot[]
  dateOverrides: ResourceDateOverride[]
  dateDisabledSlots: ResourceDateDisabledSlot[]
  branchSchedule?: WorkingHoursSchedule | null
  shiftCycle?: {
    cycleStartDate: string  // YYYY-MM-DD, день 1
    cycleLength: number     // 1..30
    // dayIndex (0..cycleLength-1) → отсортированный список slot-time "HH:MM"
    slotsByDayIndex: Record<number, string[]>
  } | null
}

// Существующая запись для проверки конфликтов (UTC timestamps)
export type AppointmentInterval = {
  startsAt: string  // UTC ISO timestamp
  endsAt: string    // UTC ISO timestamp — для open_ended: COALESCE(actual_ends_at, ends_at)
}

export type AppointmentEventType
  = | 'appointment_created'
    | 'status_changed'
    | 'field_updated'
    | 'extended'
    | 'closed_now'

export type AppointmentEvent = {
  id: string
  appointmentId: string
  tenantId: string
  actorId: string | null
  actorName: string | null
  actorRole: string | null
  eventType: AppointmentEventType
  meta: Record<string, unknown>
  createdAt: string
}

// Один найденный вариант расписания визита
export type GroupSlotOption = {
  startTime: string // "HH:MM" — начало первой услуги
  schedule: Array<{
    serviceId: string
    resourceId: string
    resourceName: string
    // Если ≠ resourceId — был указан другой предпочтительный мастер, но он недоступен
    // на этот старт, и алгоритм его заменил. UI показывает старого зачёркнутым.
    preferredResourceId: string | null
    preferredResourceName: string | null
    startTime: string // "HH:MM"
    endTime: string   // "HH:MM"
  }>
}

// Тип попадания: предпочтительные мастера полностью свободны (зелёный),
// или часть пришлось заменить на других (жёлтый).
export type GroupSlotMatch = 'preferred' | 'any'

// Слот-чипса для UI: время + тип попадания + готовое расписание визита
export type GroupSlotEntry = GroupSlotOption & { match: GroupSlotMatch }

// Результат поиска слотов для группы услуг
export type GroupSlotsResult =
  | { type: 'slots'; entries: GroupSlotEntry[] }
  | { type: 'request_only' }                                // суммарная длительность > рабочего дня
