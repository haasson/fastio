import type { WorkingHoursSchedule } from '../types/tenant'

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/**
 * Format WorkingHoursSchedule into a human-readable string.
 *
 * - All days same: "10:00 – 23:00"
 * - Different by day: "Пн–Чт: 14:00 – 02:00, Пт–Вс: 14:00 – 04:00"
 */
export function formatWorkingHours(schedule: WorkingHoursSchedule | null | undefined): string | null {
  if (!schedule) return null

  // Build array of { open, close } for each ISO day 1–7
  const days = Array.from({ length: 7 }, (_, i) => {
    const isoDay = String(i + 1) // "1"=Mon .. "7"=Sun
    return schedule.days[isoDay] ?? schedule.default
  })

  // Group consecutive days with same hours
  type Group = { from: number; to: number; open: string; close: string }
  const groups: Group[] = []

  for (let i = 0; i < 7; i++) {
    const { open, close } = days[i]
    const last = groups[groups.length - 1]
    if (last && last.open === open && last.close === close) {
      last.to = i
    } else {
      groups.push({ from: i, to: i, open, close })
    }
  }

  // All days same — just show hours
  if (groups.length === 1) {
    return `${groups[0].open} – ${groups[0].close}`
  }

  return groups
    .map((g) => {
      const range = g.from === g.to
        ? DAY_LABELS[g.from]
        : `${DAY_LABELS[g.from]}–${DAY_LABELS[g.to]}`
      return `${range}: ${g.open} – ${g.close}`
    })
    .join(', ')
}
