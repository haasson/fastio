import type {
  ResourceSlotData, ResourceSchedule, ResourceDisabledSlot,
  ResourceDateOverride, ResourceDateDisabledSlot,
  WorkingHoursSchedule, ScheduleTemplateFull, AppointmentStatus,
} from '@fastio/shared'
import {
  resolveResourceWorkingHours, getAllSlotsInWindow, getBranchHoursForDow,
  utcIsoToLocalDateTime, timeToMinutes, minutesToTimeStr,
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
 * Из шаблона weekly + графика филиала собирает ResourceSlotData ровно так
 * же, как это делает applyWeeklyToResource в schedule-templates API —
 * чтобы валидировать «как будет» без мутаций БД.
 */
export function buildSlotDataFromWeeklyTemplate(
  template: ScheduleTemplateFull,
  branchSchedule: WorkingHoursSchedule | null,
  slotStep: number,
  existingDateOverrides: ResourceDateOverride[],
  existingDateDisabledSlots: ResourceDateDisabledSlot[],
): ResourceSlotData {
  const schedules: ResourceSchedule[] = []
  const disabled: ResourceDisabledSlot[] = []

  for (let dow = 0; dow < 7; dow++) {
    const tplSlots = template.slots
      .filter((s) => s.dayIndex === dow)
      .map((s) => s.slotTime)
      .sort()

    if (tplSlots.length === 0) {
      schedules.push({ id: '', resourceId: '', dayOfWeek: dow, isWorking: false, openTime: null, closeTime: null })
      continue
    }
    const branchHours = getBranchHoursForDow(branchSchedule, dow)
    const allowed = branchHours
      ? new Set(getAllSlotsInWindow(branchHours.open, branchHours.close, slotStep))
      : null
    const effective = allowed ? tplSlots.filter((t) => allowed.has(t)) : tplSlots

    if (effective.length === 0) {
      schedules.push({ id: '', resourceId: '', dayOfWeek: dow, isWorking: false, openTime: null, closeTime: null })
      continue
    }

    const open = effective[0]
    const closeMin = timeToMinutes(effective[effective.length - 1]) + slotStep
    const close = minutesToTimeStr(closeMin)

    schedules.push({ id: '', resourceId: '', dayOfWeek: dow, isWorking: true, openTime: open, closeTime: close })

    const window = new Set(getAllSlotsInWindow(open, close, slotStep))
    const active = new Set(effective)

    for (const slot of window) {
      if (!active.has(slot)) {
        disabled.push({ id: '', resourceId: '', dayOfWeek: dow, slotTime: slot })
      }
    }
  }

  return {
    schedules,
    disabledSlots: disabled,
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
  const slotsByDayIndex: Record<number, string[]> = {}

  for (const s of template.slots) {
    const arr = slotsByDayIndex[s.dayIndex] ?? []

    arr.push(s.slotTime)
    slotsByDayIndex[s.dayIndex] = arr
  }
  for (const k of Object.keys(slotsByDayIndex)) slotsByDayIndex[Number(k)].sort()

  return {
    schedules: [],
    disabledSlots: [],
    dateOverrides: existingDateOverrides,
    dateDisabledSlots: existingDateDisabledSlots,
    branchSchedule,
    shiftCycle: {
      cycleStartDate,
      cycleLength: template.cycleLength ?? 0,
      slotsByDayIndex,
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
  slotStep: number,
): ConflictReason | null {
  const start = utcIsoToLocalDateTime(appointment.startsAt, tz)
  const end = utcIsoToLocalDateTime(appointment.endsAt, tz)

  if (start.dateStr !== end.dateStr) return 'overnight'

  const hours = resolveResourceWorkingHours(start.dateStr, slotData)

  if (!hours) return 'day-off'

  const openMin = timeToMinutes(hours.openTime)
  const closeMin = timeToMinutes(hours.closeTime)
  const startMin = timeToMinutes(start.timeStr)
  const endMin = timeToMinutes(end.timeStr)

  if (startMin < openMin || endMin > closeMin) return 'out-of-hours'

  // Disabled-слот: запись стартует на отключённом слоте.
  // Для weekly смотрим resource_disabled_slots по dow; для shift —
  // непосредственно по slotsByDayIndex (то, чего нет в активных = disabled).
  if (slotData.shiftCycle) {
    const days = Math.floor(
      (Date.UTC(...dateParts(start.dateStr)) - Date.UTC(...dateParts(slotData.shiftCycle.cycleStartDate))) / 86_400_000,
    )
    const len = slotData.shiftCycle.cycleLength
    const idx = ((days % len) + len) % len
    const active = new Set(slotData.shiftCycle.slotsByDayIndex[idx] ?? [])

    if (!active.has(start.timeStr)) return 'disabled-slot'
  } else {
    const dow = new Date(start.dateStr + 'T12:00:00').getDay()
    const isDisabled = slotData.disabledSlots.some((d) => d.dayOfWeek === dow && d.slotTime === start.timeStr)

    if (isDisabled) return 'disabled-slot'
  }

  void slotStep

  return null
}

const dateParts = (s: string): [number, number, number] => {
  const [y, m, d] = s.split('-').map(Number)

  return [y, m - 1, d]
}

export function checkAppointmentsAgainstSchedule(
  appointments: AppointmentLite[],
  resourceName: string,
  slotData: ResourceSlotData,
  tz: string,
  slotStep: number,
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []

  for (const a of appointments) {
    const reason = checkAppointmentAgainstSchedule(a, slotData, tz, slotStep)

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
