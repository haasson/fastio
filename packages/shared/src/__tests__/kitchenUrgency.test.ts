import { describe, it, expect } from 'vitest'
import { getKitchenUrgencyLevel, formatKitchenElapsed } from '../kitchen-helpers'

describe('getKitchenUrgencyLevel', () => {
  const threshold = 15 // минут

  it('< 2/3 порога → normal', () => {
    const now = new Date('2026-04-11T10:09:00Z') // 9 мин назад
    const created = '2026-04-11T10:00:00Z'

    expect(getKitchenUrgencyLevel(created, now, threshold)).toBe('normal')
  })

  it('= 2/3 порога → warning', () => {
    const now = new Date('2026-04-11T10:10:00Z') // 10 мин
    const created = '2026-04-11T10:00:00Z'

    expect(getKitchenUrgencyLevel(created, now, threshold)).toBe('warning')
  })

  it('между 2/3 и порогом → warning', () => {
    const now = new Date('2026-04-11T10:12:00Z') // 12 мин
    const created = '2026-04-11T10:00:00Z'

    expect(getKitchenUrgencyLevel(created, now, threshold)).toBe('warning')
  })

  it('= порогу → critical', () => {
    const now = new Date('2026-04-11T10:15:00Z') // 15 мин
    const created = '2026-04-11T10:00:00Z'

    expect(getKitchenUrgencyLevel(created, now, threshold)).toBe('critical')
  })

  it('> порога → critical', () => {
    const now = new Date('2026-04-11T10:30:00Z') // 30 мин
    const created = '2026-04-11T10:00:00Z'

    expect(getKitchenUrgencyLevel(created, now, threshold)).toBe('critical')
  })

  it('0 минут → normal', () => {
    const now = new Date('2026-04-11T10:00:00Z')
    const created = '2026-04-11T10:00:00Z'

    expect(getKitchenUrgencyLevel(created, now, threshold)).toBe('normal')
  })

  it('порог 30 мин, прошло 20 → warning (2/3 = 20)', () => {
    const now = new Date('2026-04-11T10:20:00Z')
    const created = '2026-04-11T10:00:00Z'

    expect(getKitchenUrgencyLevel(created, now, 30)).toBe('warning')
  })
})

describe('formatKitchenElapsed', () => {
  it('< 1 мин → "<1 мин"', () => {
    const now = new Date('2026-04-11T10:00:30Z')

    expect(formatKitchenElapsed('2026-04-11T10:00:00Z', now)).toBe('<1 мин')
  })

  it('5 минут', () => {
    const now = new Date('2026-04-11T10:05:00Z')

    expect(formatKitchenElapsed('2026-04-11T10:00:00Z', now)).toBe('5 мин')
  })

  it('59 минут', () => {
    const now = new Date('2026-04-11T10:59:00Z')

    expect(formatKitchenElapsed('2026-04-11T10:00:00Z', now)).toBe('59 мин')
  })

  it('ровно 1 час', () => {
    const now = new Date('2026-04-11T11:00:00Z')

    expect(formatKitchenElapsed('2026-04-11T10:00:00Z', now)).toBe('1ч')
  })

  it('1 час 15 мин', () => {
    const now = new Date('2026-04-11T11:15:00Z')

    expect(formatKitchenElapsed('2026-04-11T10:00:00Z', now)).toBe('1ч 15м')
  })

  it('2 часа ровно', () => {
    const now = new Date('2026-04-11T12:00:00Z')

    expect(formatKitchenElapsed('2026-04-11T10:00:00Z', now)).toBe('2ч')
  })
})
