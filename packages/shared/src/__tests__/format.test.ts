import { describe, it, expect } from 'vitest'
import { pluralize } from '../utils/format'
import { formatRelativeTime } from '../utils/date'

describe('pluralize', () => {
  it('1 → форма one', () => {
    expect(pluralize(1, 'день', 'дня', 'дней')).toBe('день')
  })

  it('2, 3, 4 → форма few', () => {
    expect(pluralize(2, 'день', 'дня', 'дней')).toBe('дня')
    expect(pluralize(3, 'день', 'дня', 'дней')).toBe('дня')
    expect(pluralize(4, 'день', 'дня', 'дней')).toBe('дня')
  })

  it('5-20 → форма many', () => {
    expect(pluralize(5, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralize(11, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralize(12, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralize(19, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralize(20, 'день', 'дня', 'дней')).toBe('дней')
  })

  it('11-19 (исключение) → форма many, не one/few', () => {
    expect(pluralize(11, 'минута', 'минуты', 'минут')).toBe('минут')
    expect(pluralize(14, 'минута', 'минуты', 'минут')).toBe('минут')
  })

  it('21, 31, 41 → форма one', () => {
    expect(pluralize(21, 'день', 'дня', 'дней')).toBe('день')
    expect(pluralize(31, 'день', 'дня', 'дней')).toBe('день')
    expect(pluralize(101, 'день', 'дня', 'дней')).toBe('день')
  })

  it('22, 23, 24 → форма few', () => {
    expect(pluralize(22, 'день', 'дня', 'дней')).toBe('дня')
    expect(pluralize(23, 'день', 'дня', 'дней')).toBe('дня')
  })

  it('0 → форма many', () => {
    expect(pluralize(0, 'день', 'дня', 'дней')).toBe('дней')
  })

  it('отрицательные числа работают корректно', () => {
    expect(pluralize(-1, 'день', 'дня', 'дней')).toBe('день')
    expect(pluralize(-5, 'день', 'дня', 'дней')).toBe('дней')
  })
})

describe('formatRelativeTime', () => {
  const makeNow = (iso: string) => new Date(iso)
  const minutesAgo = (now: Date, minutes: number) =>
    new Date(now.getTime() - minutes * 60_000).toISOString()

  it('"только что" — меньше минуты назад', () => {
    const now = makeNow('2026-03-15T12:00:00Z')
    expect(formatRelativeTime(minutesAgo(now, 0), now)).toBe('только что')
  })

  it('"N мин назад" — от 1 до 59 минут', () => {
    const now = makeNow('2026-03-15T12:00:00Z')
    expect(formatRelativeTime(minutesAgo(now, 1), now)).toBe('1 мин назад')
    expect(formatRelativeTime(minutesAgo(now, 30), now)).toBe('30 мин назад')
    expect(formatRelativeTime(minutesAgo(now, 59), now)).toBe('59 мин назад')
  })

  it('"N ч назад" — от 1 до 23 часов', () => {
    const now = makeNow('2026-03-15T12:00:00Z')
    expect(formatRelativeTime(minutesAgo(now, 60), now)).toBe('1 ч назад')
    expect(formatRelativeTime(minutesAgo(now, 120), now)).toBe('2 ч назад')
    expect(formatRelativeTime(minutesAgo(now, 23 * 60), now)).toBe('23 ч назад')
  })

  it('старше суток → полная дата', () => {
    const now = makeNow('2026-03-15T12:00:00Z')
    const old = minutesAgo(now, 25 * 60)
    const result = formatRelativeTime(old, now)
    expect(result).not.toContain('мин назад')
    expect(result).not.toContain('ч назад')
    expect(result).not.toBe('только что')
  })
})
