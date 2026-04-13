import type { WorkingHoursSchedule } from '../types/tenant'
import { getIsoDayForDate, generateTimeSlots, timeToMinutes, minutesToTimeStr } from './timezone'
import { getDaySchedule } from './workingHours'
import { formatMinutes } from './date'

export type SlotOption = { value: string; label: string; disabled?: boolean }

/**
 * Генерирует доступные слоты для конкретной даты с учётом расписания, буфера и lead time.
 * Overnight-слоты кодируются суффиксом "+1" в value (например "02:30+1").
 */
export function getAvailableSlots(
  dateStr: string,
  schedule: WorkingHoursSchedule | null | undefined,
  opts: { step: number; leadMinutes: number; closeBufferMinutes: number; nowMinutes: number | null },
): SlotOption[] {
  const { step, leadMinutes, closeBufferMinutes, nowMinutes } = opts

  let open = '10:00'
  let close = '22:00'

  if (schedule) {
    if (schedule.default.allDay) {
      return Array.from({ length: Math.floor(1440 / step) }, (_, i) => {
        const timeStr = minutesToTimeStr(i * step)
        return { value: timeStr, label: timeStr }
      })
    }
    const isoDay = Number(getIsoDayForDate(dateStr))
    const day = getDaySchedule(schedule, isoDay)
    if (day.dayOff) return []
    open = day.open
    close = day.close
  }

  const allSlots = generateTimeSlots(open, close, step, closeBufferMinutes)

  return allSlots
    .filter(({ timeStr, nextDay }) => {
      if (nowMinutes === null) return true
      const slotMin = timeToMinutes(timeStr) + (nextDay ? 1440 : 0)
      return slotMin >= nowMinutes + leadMinutes
    })
    // Overnight-слоты (nextDay) к��дируются суффиксом "+1" в value, чтобы при submit'е
    // сдвинуть дату на +1 день. Например "02:30+1" → завтра в 02:30.
    .map(({ timeStr, nextDay }) => ({
      value: nextDay ? `${timeStr}+1` : timeStr,
      label: timeStr,
    }))
}

/** Генерирует опции для select'а с шагом в минутах: [{label: "30 мин", value: 30}, ...] */
export function buildMinuteOptions(step: number, max: number, withNone = false): { label: string; value: number }[] {
  const opts: { label: string; value: number }[] = withNone ? [{ label: 'Нет', value: 0 }] : []
  for (let v = step; v <= max; v += step) {
    opts.push({ label: formatMinutes(v), value: v })
  }
  return opts
}
