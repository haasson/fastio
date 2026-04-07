import { describe, it, expect } from 'vitest'
import { formatWorkingHours } from '../utils/workingHours'
import type { WorkingHoursSchedule } from '../types/tenant'

describe('formatWorkingHours', () => {
  it('возвращает null для null/undefined', () => {
    expect(formatWorkingHours(null)).toBeNull()
    expect(formatWorkingHours(undefined)).toBeNull()
  })

  it('все дни одинаковые — только часы', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '23:00' },
      days: {},
    }
    expect(formatWorkingHours(schedule)).toBe('10:00 – 23:00')
  })

  it('две группы — будни и выходные', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '22:00' },
      days: {
        '6': { open: '11:00', close: '23:00' },
        '7': { open: '11:00', close: '23:00' },
      },
    }
    expect(formatWorkingHours(schedule)).toBe('Пн–Пт: 10:00 – 22:00, Сб–Вс: 11:00 – 23:00')
  })

  it('каждый день разный — каждый отдельно', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '20:00' },
      days: {
        '2': { open: '11:00', close: '21:00' },
        '4': { open: '12:00', close: '22:00' },
        '6': { open: '13:00', close: '23:00' },
      },
    }
    expect(formatWorkingHours(schedule)).toBe(
      'Пн: 10:00 – 20:00, Вт: 11:00 – 21:00, Ср: 10:00 – 20:00, Чт: 12:00 – 22:00, Пт: 10:00 – 20:00, Сб: 13:00 – 23:00, Вс: 10:00 – 20:00',
    )
  })

  it('один выделенный день', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '14:00', close: '02:00' },
      days: {
        '5': { open: '14:00', close: '04:00' },
      },
    }
    expect(formatWorkingHours(schedule)).toBe('Пн–Чт: 14:00 – 02:00, Пт: 14:00 – 04:00, Сб–Вс: 14:00 – 02:00')
  })
})
