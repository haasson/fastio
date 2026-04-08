import type { WorkingHours, WorkingHoursSchedule } from '../types/tenant'

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const DAY_NAMES_PREPOSITIONAL = ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье']

/**
 * Format WorkingHoursSchedule into a human-readable string.
 *
 * - allDay: "Круглосуточно"
 * - All days same: "10:00 – 23:00"
 * - Different by day: "Пн–Чт: 14:00 – 02:00, Пт–Вс: 14:00 – 04:00"
 * - Day off days grouped: "Пн–Пт: 10:00 – 22:00, Сб–Вс: выходной"
 */
export function formatWorkingHours(schedule: WorkingHoursSchedule | null | undefined): string | null {
  if (!schedule) return null

  if (schedule.default.allDay) return 'Круглосуточно'

  // Build array of day info for each ISO day 1–7
  const days = Array.from({ length: 7 }, (_, i) => {
    const isoDay = String(i + 1)
    return schedule.days[isoDay] ?? schedule.default
  })

  // Check if all days are dayOff
  if (days.every(d => d.dayOff)) return 'Закрыто'

  // Group consecutive days with same hours/dayOff status
  type Group = { from: number; to: number; open: string; close: string; dayOff: boolean }
  const groups: Group[] = []

  for (let i = 0; i < 7; i++) {
    const day = days[i]
    const isDayOff = !!day.dayOff
    const last = groups[groups.length - 1]

    if (last && last.dayOff === isDayOff && (isDayOff || (last.open === day.open && last.close === day.close))) {
      last.to = i
    } else {
      groups.push({ from: i, to: i, open: day.open, close: day.close, dayOff: isDayOff })
    }
  }

  // All days same — just show hours
  if (groups.length === 1) {
    return groups[0].dayOff ? 'Закрыто' : `${groups[0].open} – ${groups[0].close}`
  }

  return groups
    .map((g) => {
      const range = g.from === g.to
        ? DAY_LABELS[g.from]
        : `${DAY_LABELS[g.from]}–${DAY_LABELS[g.to]}`
      const hours = g.dayOff ? 'выходной' : `${g.open} – ${g.close}`
      return `${range}: ${hours}`
    })
    .join(', ')
}

/**
 * Get current time parts in a given timezone.
 */
function getTimeInTimezone(date: Date, timezone: string): { hours: number; minutes: number; isoDay: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const hours = Number(parts.find(p => p.type === 'hour')!.value)
  const minutes = Number(parts.find(p => p.type === 'minute')!.value)
  const weekday = parts.find(p => p.type === 'weekday')!.value

  // Map JS weekday abbreviation to ISO day (1=Mon..7=Sun)
  const weekdayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  }
  const isoDay = weekdayMap[weekday]

  return { hours, minutes, isoDay }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function getDaySchedule(schedule: WorkingHoursSchedule, isoDay: number): WorkingHours {
  return schedule.days[String(isoDay)] ?? schedule.default
}

function isOvernight(wh: WorkingHours): boolean {
  return timeToMinutes(wh.close) < timeToMinutes(wh.open)
}

function prevIsoDay(isoDay: number): number {
  return isoDay === 1 ? 7 : isoDay - 1
}

type IsOpenResult = {
  open: boolean
  nextChange: { day: string; time: string; offsetDays: number } | null
}

/**
 * Check if a venue is currently open based on its working hours schedule.
 */
export function isOpenNow(
  schedule: WorkingHoursSchedule | null | undefined,
  timezone: string,
  now?: Date,
): IsOpenResult {
  if (!schedule) return { open: true, nextChange: null }
  if (schedule.default.allDay) return { open: true, nextChange: null }

  const date = now ?? new Date()
  const { hours, minutes, isoDay } = getTimeInTimezone(date, timezone)
  const currentMinutes = hours * 60 + minutes

  const todaySchedule = getDaySchedule(schedule, isoDay)
  const yesterdayIso = prevIsoDay(isoDay)
  const yesterdaySchedule = getDaySchedule(schedule, yesterdayIso)

  // 1. Check yesterday's overnight tail
  if (!yesterdaySchedule.dayOff && isOvernight(yesterdaySchedule)) {
    const yesterdayClose = timeToMinutes(yesterdaySchedule.close)
    if (currentMinutes < yesterdayClose) {
      return { open: true, nextChange: null }
    }
  }

  // 2. Today is dayOff
  if (todaySchedule.dayOff) {
    return { open: false, nextChange: findNextOpening(schedule, isoDay, 0) }
  }

  const openMin = timeToMinutes(todaySchedule.open)
  const closeMin = timeToMinutes(todaySchedule.close)
  const overnight = isOvernight(todaySchedule)

  // 3. Before today's opening
  if (currentMinutes < openMin) {
    return { open: false, nextChange: { day: 'сегодня', time: todaySchedule.open, offsetDays: 0 } }
  }

  // 4. Overnight shift — open until close tomorrow (currentMinutes >= openMin guaranteed by step 3)
  if (overnight) {
    return { open: true, nextChange: null }
  }

  // 5. Regular shift, currently within hours
  if (currentMinutes < closeMin) {
    return { open: true, nextChange: null }
  }

  // 6. After closing — find next opening
  return { open: false, nextChange: findNextOpening(schedule, isoDay, 1) }
}

/**
 * Find the next opening day/time starting from `startIsoDay + offsetDays`.
 * offsetDays: 0 = search from today (for dayOff), 1 = search from tomorrow (after close).
 */
function findNextOpening(
  schedule: WorkingHoursSchedule,
  todayIsoDay: number,
  offsetDays: number,
): { day: string; time: string; offsetDays: number } | null {
  for (let d = offsetDays; d <= 7; d++) {
    let checkDay = todayIsoDay + d
    if (checkDay > 7) checkDay -= 7
    const daySchedule = getDaySchedule(schedule, checkDay)
    if (daySchedule.dayOff) continue

    const dayLabel = d === 0 ? 'сегодня'
      : d === 1 ? 'завтра'
        : DAY_NAMES_PREPOSITIONAL[checkDay - 1]

    return { day: dayLabel, time: daySchedule.open, offsetDays: d }
  }
  return null
}
