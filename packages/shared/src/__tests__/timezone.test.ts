import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getIsoDayForDate, addDaysToDateStr, todayInTz, nowTimeInTz } from '../utils/timezone'

describe('getIsoDayForDate', () => {
  it('понедельник → 1', () => {
    expect(getIsoDayForDate('2026-03-16')).toBe('1') // пн
  })

  it('вторник → 2', () => {
    expect(getIsoDayForDate('2026-03-17')).toBe('2')
  })

  it('среда → 3', () => {
    expect(getIsoDayForDate('2026-03-18')).toBe('3')
  })

  it('пятница → 5', () => {
    expect(getIsoDayForDate('2026-03-20')).toBe('5')
  })

  it('суббота → 6', () => {
    expect(getIsoDayForDate('2026-03-21')).toBe('6')
  })

  it('воскресенье → 7 (не 0)', () => {
    expect(getIsoDayForDate('2026-03-22')).toBe('7')
  })
})

describe('addDaysToDateStr', () => {
  it('+1 день', () => {
    expect(addDaysToDateStr('2026-03-15', 1)).toBe('2026-03-16')
  })

  it('+7 дней (неделя)', () => {
    expect(addDaysToDateStr('2026-03-15', 7)).toBe('2026-03-22')
  })

  it('переход через конец месяца', () => {
    expect(addDaysToDateStr('2026-03-30', 2)).toBe('2026-04-01')
  })

  it('переход через конец года', () => {
    expect(addDaysToDateStr('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('+0 дней — та же дата', () => {
    expect(addDaysToDateStr('2026-03-15', 0)).toBe('2026-03-15')
  })

  it('февраль в високосный год', () => {
    expect(addDaysToDateStr('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('февраль в не-високосный год', () => {
    expect(addDaysToDateStr('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('todayInTz', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('возвращает дату в формате YYYY-MM-DD', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    const result = todayInTz('Europe/Moscow')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('Москва (UTC+3): UTC 22:00 → следующий день в МСК', () => {
    vi.setSystemTime(new Date('2026-03-14T22:00:00Z')) // в МСК уже 01:00 15 марта
    expect(todayInTz('Europe/Moscow')).toBe('2026-03-15')
  })

  it('UTC: UTC 22:00 → тот же день', () => {
    vi.setSystemTime(new Date('2026-03-14T22:00:00Z'))
    expect(todayInTz('UTC')).toBe('2026-03-14')
  })
})

describe('nowTimeInTz', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('возвращает время в формате HH:MM', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    const result = nowTimeInTz('Europe/Moscow')
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('Москва (UTC+3): UTC 10:00 → 13:00 МСК', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    expect(nowTimeInTz('Europe/Moscow')).toBe('13:00')
  })

  it('Владивосток (UTC+10): UTC 10:00 → 20:00', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    expect(nowTimeInTz('Asia/Vladivostok')).toBe('20:00')
  })
})
