import type {
  ResourceSlotData, ResourceSchedule,
  ResourceDateOverride, ResourceDateDisabledSlot,
  WorkingHoursSchedule, ScheduleTemplateFull, AppointmentStatus,
} from '@fastio/shared'
import {
  resolveResourceWorkingHours,
  utcIsoToLocalDateTime, timeToMinutes,
} from '@fastio/shared'

export type AppointmentLite = {
  id: string
  resourceId: string
  startsAt: string
  endsAt: string
  customerName: string
  status: AppointmentStatus
}

export type ConflictReason = 'day-off' | 'out-of-hours' | 'disabled-slot' | 'overnight'

export type ScheduleConflict = {
  appointment: AppointmentLite
  resourceName: string
  localDate: string
  localStart: string
  localEnd: string
  reason: ConflictReason
}

/**
 * Из шаблона weekly собирает ResourceSlotData ровно так же, как RPC
 * apply_weekly_template_to_resource — копирует часы шаблона 1:1, без
 * обрезки по часам филиала и без disabled_slots.
 */
export function buildSlotDataFromWeeklyTemplate(
  template: ScheduleTemplateFull,
  branchSchedule: WorkingHoursSchedule | null,
  existingDateOverrides: ResourceDateOverride[],
  existingDateDisabledSlots: ResourceDateDisabledSlot[],
): ResourceSlotData {
  const schedules: ResourceSchedule[] = []

  for (let dow = 0; dow < 7; dow++) {
    const day = template.days.find((d) => d.dayIndex === dow)

    if (!day || !day.isWorking || !day.openTime || !day.closeTime) {
      schedules.push({ id: '', resourceId: '', dayOfWeek: dow, isWorking: false, openTime: null, closeTime: null })
      continue
    }
    schedules.push({
      id: '', resourceId: '', dayOfWeek: dow,
      isWorking: true,
      openTime: day.openTime,
      closeTime: day.closeTime,
    })
  }

  return {
    schedules,
    disabledSlots: [],
    dateOverrides: existingDateOverrides,
    dateDisabledSlots: existingDateDisabledSlots,
    branchSchedule,
    shiftCycle: null,
  }
}

/**
 * Из shift-шаблона + дня старта цикла на ресурсе собирает ResourceSlotData,
 * чтобы прогнать lazy-расчёт через resolveResourceWorkingHours.
 */
export function buildSlotDataFromShiftTemplate(
  template: ScheduleTemplateFull,
  cycleStartDate: string,
  branchSchedule: WorkingHoursSchedule | null,
  existingDateOverrides: ResourceDateOverride[],
  existingDateDisabledSlots: ResourceDateDisabledSlot[],
): ResourceSlotData {
  const hoursByDayIndex: Record<number, { openTime: string; closeTime: string } | null> = {}

  for (const d of template.days) {
    if (!d.isWorking || !d.openTime || !d.closeTime) {
      hoursByDayIndex[d.dayIndex] = null
    } else {
      hoursByDayIndex[d.dayIndex] = { openTime: d.openTime, closeTime: d.closeTime }
    }
  }

  return {
    schedules: [],
    disabledSlots: [],
    dateOverrides: existingDateOverrides,
    dateDisabledSlots: existingDateDisabledSlots,
    branchSchedule,
    shiftCycle: {
      cycleStartDate,
      cycleLength: template.cycleLength ?? 0,
      hoursByDayIndex,
    },
  }
}

/**
 * Проверяет одну запись против slotData. Возвращает причину конфликта или null.
 *
 * Сравнения по локальной TZ тенанта: запись 14:00–15:00 в зоне +03 — это
 * именно те значения, что админ видит в UI и привязывает к рабочим часам.
 */
export function checkAppointmentAgainstSchedule(
  appointment: AppointmentLite,
  slotData: ResourceSlotData,
  tz: string,
): ConflictReason | null {
  const start = utcIsoToLocalDateTime(appointment.startsAt, tz)
  const end = utcIsoToLocalDateTime(appointment.endsAt, tz)

  const hours = resolveResourceWorkingHours(start.dateStr, slotData)

  if (!hours) return 'day-off'

  const openMin = timeToMinutes(hours.openTime)
  const closeMinRaw = timeToMinutes(hours.closeTime)
  // Overnight-семантика согласована со slot engine (`appointmentSlots.ts`):
  //   close <  open ⇒ overnight (окно [open, close+1440));
  //   close == open ⇒ 24/7 (окно бесконечное, проверка часов не имеет смысла).
  const allDay = closeMinRaw === openMin
  const overnight = closeMinRaw < openMin
  const closeMin = overnight ? closeMinRaw + 1440 : closeMinRaw

  // Запись на разных календарных днях допустима только для overnight или 24/7.
  if (start.dateStr !== end.dateStr && !overnight && !allDay) return 'overnight'

  // Для 24/7 проверка часов не нужна (любое время валидно). Дальше — только disabled.
  if (!allDay) {
    const startMin = timeToMinutes(start.timeStr)
    const endMinRaw = timeToMinutes(end.timeStr)
    // Если end в следующие сутки относительно start — endMin = endRaw + 1440.
    const endMin = (start.dateStr !== end.dateStr) ? endMinRaw + 1440 : endMinRaw

    if (startMin < openMin || endMin > closeMin) return 'out-of-hours'
  }

  // Disabled-слот применяется только для weekly (для shift перерывов внутри
  // смены нет — выходные дни декларируются целиком через hoursByDayIndex=null).
  if (!slotData.shiftCycle) {
    const dow = new Date(start.dateStr + 'T12:00:00').getDay()
    const isDisabled = slotData.disabledSlots.some((d) => d.dayOfWeek === dow && d.slotTime === start.timeStr)

    if (isDisabled) return 'disabled-slot'
  }

  return null
}

export function checkAppointmentsAgainstSchedule(
  appointments: AppointmentLite[],
  resourceName: string,
  slotData: ResourceSlotData,
  tz: string,
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []

  for (const a of appointments) {
    const reason = checkAppointmentAgainstSchedule(a, slotData, tz)

    if (reason) {
      const start = utcIsoToLocalDateTime(a.startsAt, tz)
      const end = utcIsoToLocalDateTime(a.endsAt, tz)

      conflicts.push({
        appointment: a,
        resourceName,
        localDate: start.dateStr,
        localStart: start.timeStr,
        localEnd: end.timeStr,
        reason,
      })
    }
  }

  return conflicts
}
