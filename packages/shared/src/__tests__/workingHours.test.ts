import { describe, it, expect } from 'vitest'
import { formatWorkingHours, isOpenNow, getScheduleForDate } from '../utils/workingHours'
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

  it('круглосуточно', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '00:00', close: '00:00', allDay: true },
      days: {},
    }
    expect(formatWorkingHours(schedule)).toBe('Круглосуточно')
  })

  it('выходные дни группируются', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '22:00' },
      days: {
        '6': { open: '10:00', close: '22:00', dayOff: true },
        '7': { open: '10:00', close: '22:00', dayOff: true },
      },
    }
    expect(formatWorkingHours(schedule)).toBe('Пн–Пт: 10:00 – 22:00, Сб–Вс: выходной')
  })

  it('один выходной день', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '22:00' },
      days: {
        '7': { open: '10:00', close: '22:00', dayOff: true },
      },
    }
    expect(formatWorkingHours(schedule)).toBe('Пн–Сб: 10:00 – 22:00, Вс: выходной')
  })
})

describe('isOpenNow', () => {
  it('возвращает open=true если schedule=null', () => {
    const result = isOpenNow(null, 'Europe/Moscow')
    expect(result.open).toBe(true)
    expect(result.nextChange).toBeNull()
  })

  it('круглосуточно — всегда открыто', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '00:00', close: '00:00', allDay: true },
      days: {},
    }
    const result = isOpenNow(schedule, 'Europe/Moscow')
    expect(result.open).toBe(true)
    expect(result.nextChange).toBeNull()
  })

  it('открыто в рабочее время', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '22:00' },
      days: {},
    }
    const now = new Date('2026-04-06T12:00:00Z') // 15:00 MSK Mon
    const result = isOpenNow(schedule, 'Europe/Moscow', now)
    expect(result.open).toBe(true)
    expect(result.closingAt).toBe('22:00')
    expect(result.minutesUntilClose).toBe(420) // 22:00 - 15:00 = 7h = 420 min
  })

  it('закрыто до открытия', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '22:00' },
      days: {},
    }
    const now = new Date('2026-04-06T05:00:00Z') // 08:00 MSK Mon
    const result = isOpenNow(schedule, 'Europe/Moscow', now)
    expect(result.open).toBe(false)
    expect(result.nextChange).toEqual({ day: 'сегодня', time: '10:00', offsetDays: 0 })
  })

  it('закрыто после закрытия', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '22:00' },
      days: {},
    }
    const now = new Date('2026-04-06T20:00:00Z') // 23:00 MSK Mon
    const result = isOpenNow(schedule, 'Europe/Moscow', now)
    expect(result.open).toBe(false)
    expect(result.nextChange).toEqual({ day: 'завтра', time: '10:00', offsetDays: 1 })
  })

  it('ночная смена — открыто после полуночи (хвост вчерашней смены)', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '14:00', close: '03:00' },
      days: {},
    }
    const now = new Date('2026-04-06T21:30:00Z') // 00:30 MSK Tue Apr 7
    const result = isOpenNow(schedule, 'Europe/Moscow', now)
    expect(result.open).toBe(true)
    expect(result.closingAt).toBe('03:00')
    expect(result.minutesUntilClose).toBe(150) // 03:00 - 00:30 = 2.5h = 150 min
  })

  it('ночная смена — закрыто после хвоста', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '14:00', close: '03:00' },
      days: {},
    }
    const now = new Date('2026-04-07T01:00:00Z') // 04:00 MSK Tue
    const result = isOpenNow(schedule, 'Europe/Moscow', now)
    expect(result.open).toBe(false)
    expect(result.nextChange).toEqual({ day: 'сегодня', time: '14:00', offsetDays: 0 })
  })

  it('выходной день — закрыто', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '22:00' },
      days: {
        '7': { open: '10:00', close: '22:00', dayOff: true },
      },
    }
    const now = new Date('2026-04-12T12:00:00Z') // 15:00 MSK Sun
    const result = isOpenNow(schedule, 'Europe/Moscow', now)
    expect(result.open).toBe(false)
    expect(result.nextChange).toEqual({ day: 'завтра', time: '10:00', offsetDays: 1 })
  })

  it('выходной — но хвост вчерашней ночной смены ещё идёт', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '14:00', close: '03:00' },
      days: {
        '7': { open: '14:00', close: '03:00', dayOff: true },
      },
    }
    const now = new Date('2026-04-11T22:00:00Z') // 01:00 MSK Sun
    const result = isOpenNow(schedule, 'Europe/Moscow', now)
    expect(result.open).toBe(true)
  })

  it('nextChange показывает день недели если не сегодня/завтра', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '22:00' },
      days: {
        '6': { open: '10:00', close: '22:00', dayOff: true },
        '7': { open: '10:00', close: '22:00', dayOff: true },
      },
    }
    const now = new Date('2026-04-11T12:00:00Z') // 15:00 MSK Sat
    const result = isOpenNow(schedule, 'Europe/Moscow', now)
    expect(result.open).toBe(false)
    expect(result.nextChange).toEqual({ day: 'в понедельник', time: '10:00', offsetDays: 2 })
  })

  it('полночь — корректно парсится (хвост ночной смены)', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '22:00', close: '06:00' },
      days: {},
    }
    const now = new Date('2026-04-06T21:00:00Z') // 00:00 MSK Tue
    const result = isOpenNow(schedule, 'Europe/Moscow', now)
    expect(result.open).toBe(true)
  })

  it('ровно в момент закрытия — считается закрытым', () => {
    const schedule: WorkingHoursSchedule = {
      default: { open: '10:00', close: '22:00' },
      days: {},
    }
    const now = new Date('2026-04-06T19:00:00Z') // 22:00 MSK Mon
    const result = isOpenNow(schedule, 'Europe/Moscow', now)
    expect(result.open).toBe(false)
    expect(result.nextChange).toEqual({ day: 'завтра', time: '10:00', offsetDays: 1 })
  })
})

// 2026-04-06 = Пн (ISO 1), 2026-04-12 = Вс (ISO 7)
// 2026-01-01 = Чт (ISO 4)

describe('getScheduleForDate', () => {
  const base: WorkingHoursSchedule = {
    default: { open: '10:00', close: '22:00' },
    days: {
      '1': { open: '09:00', close: '21:00' }, // Пн
    },
  }

  it('падает на default когда нет ни override, ни исключений', () => {
    const result = getScheduleForDate(base, '2026-04-07') // Вт, без override
    expect(result).toEqual({ open: '10:00', close: '22:00' })
  })

  it('возвращает weekday override (Пн)', () => {
    const result = getScheduleForDate(base, '2026-04-06') // Пн
    expect(result).toEqual({ open: '09:00', close: '21:00' })
  })

  it('recurringException перебивает weekday override', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      recurringExceptions: { '--04-06': { open: '12:00', close: '16:00', dayOff: false } },
    }
    const result = getScheduleForDate(schedule, '2026-04-06') // Пн + recurring
    expect(result).toEqual({ open: '12:00', close: '16:00', dayOff: false })
  })

  it('конкретная дата перебивает recurringException', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      recurringExceptions: { '--04-06': { open: '12:00', close: '16:00' } },
      exceptions: { '2026-04-06': { open: '08:00', close: '14:00', dayOff: false } },
    }
    const result = getScheduleForDate(schedule, '2026-04-06')
    expect(result).toEqual({ open: '08:00', close: '14:00', dayOff: false })
  })

  it('конкретная дата как выходной', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      exceptions: { '2026-04-06': { open: '10:00', close: '22:00', dayOff: true } },
    }
    const result = getScheduleForDate(schedule, '2026-04-06')
    expect(result.dayOff).toBe(true)
  })

  it('recurring выходной (ежегодно 1 января)', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      recurringExceptions: { '--01-01': { open: '10:00', close: '22:00', dayOff: true } },
    }
    // 2026-01-01 = Чт, weekday default → 10:00-22:00, но recurring = dayOff
    const result = getScheduleForDate(schedule, '2026-01-01')
    expect(result.dayOff).toBe(true)
    // та же --01-01 срабатывает в другой год
    const result2027 = getScheduleForDate(schedule, '2027-01-01')
    expect(result2027.dayOff).toBe(true)
  })

  it('исключение не затрагивает другие даты', () => {
    const schedule: WorkingHoursSchedule = {
      ...base,
      exceptions: { '2026-04-06': { open: '10:00', close: '22:00', dayOff: true } },
    }
    const result = getScheduleForDate(schedule, '2026-04-07') // Вт — не затронут
    expect(result.dayOff).toBeFalsy()
  })
})

describe('isOpenNow с исключениями', () => {
  const schedule: WorkingHoursSchedule = {
    default: { open: '10:00', close: '22:00' },
    days: {},
  }

  it('закрыто если конкретная дата помечена dayOff', () => {
    const s: WorkingHoursSchedule = {
      ...schedule,
      exceptions: { '2026-04-06': { open: '10:00', close: '22:00', dayOff: true } },
    }
    const now = new Date('2026-04-06T12:00:00Z') // 15:00 MSK Пн — обычно открыто
    const result = isOpenNow(s, 'Europe/Moscow', now)
    expect(result.open).toBe(false)
  })

  it('открыто с кастомными часами из исключения', () => {
    const s: WorkingHoursSchedule = {
      ...schedule,
      exceptions: { '2026-04-06': { open: '14:00', close: '18:00' } },
    }
    const now = new Date('2026-04-06T12:00:00Z') // 15:00 MSK — внутри 14:00–18:00
    const result = isOpenNow(s, 'Europe/Moscow', now)
    expect(result.open).toBe(true)
    expect(result.closingAt).toBe('18:00')
  })

  it('закрыто до начала кастомных часов из исключения', () => {
    const s: WorkingHoursSchedule = {
      ...schedule,
      exceptions: { '2026-04-06': { open: '14:00', close: '18:00' } },
    }
    const now = new Date('2026-04-06T09:00:00Z') // 12:00 MSK — до 14:00
    const result = isOpenNow(s, 'Europe/Moscow', now)
    expect(result.open).toBe(false)
    expect(result.nextChange).toEqual({ day: 'сегодня', time: '14:00', offsetDays: 0 })
  })

  it('recurring dayOff закрывает в нужную дату', () => {
    const s: WorkingHoursSchedule = {
      ...schedule,
      recurringExceptions: { '--04-06': { open: '10:00', close: '22:00', dayOff: true } },
    }
    const now = new Date('2026-04-06T12:00:00Z') // 15:00 MSK Пн
    const result = isOpenNow(s, 'Europe/Moscow', now)
    expect(result.open).toBe(false)
  })

  it('nextChange пропускает dayOff-исключение и находит следующий открытый день', () => {
    const s: WorkingHoursSchedule = {
      default: { open: '10:00', close: '22:00' },
      days: {},
      exceptions: {
        '2026-04-06': { open: '10:00', close: '22:00', dayOff: true }, // Пн — выходной
        '2026-04-07': { open: '10:00', close: '22:00', dayOff: true }, // Вт — выходной
      },
    }
    const now = new Date('2026-04-06T20:00:00Z') // 23:00 MSK Пн — после закрытия обычного дня
    const result = isOpenNow(s, 'Europe/Moscow', now)
    expect(result.open).toBe(false)
    // Пн dayOff, Вт dayOff → следующий Ср
    expect(result.nextChange?.offsetDays).toBe(2)
    expect(result.nextChange?.time).toBe('10:00')
  })
})
