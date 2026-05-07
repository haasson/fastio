import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectivePromoStatus } from '../promoStatus'

const NOW = new Date('2026-03-15T12:00:00Z')

describe('effectivePromoStatus', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('inactive при active=false', () => {
    vi.setSystemTime(NOW)
    const result = effectivePromoStatus({ active: false, activeFrom: null, activeTo: null })

    expect(result.key).toBe('inactive')
    expect(result.type).toBe('error')
  })

  it('scheduled если activeFrom в будущем', () => {
    vi.setSystemTime(NOW)
    const future = new Date(NOW.getTime() + 86400000).toISOString()
    const result = effectivePromoStatus({ active: true, activeFrom: future, activeTo: null })

    expect(result.key).toBe('scheduled')
    expect(result.type).toBe('primary')
  })

  it('expired если activeTo в прошлом', () => {
    vi.setSystemTime(NOW)
    const past = new Date(NOW.getTime() - 86400000).toISOString()
    const result = effectivePromoStatus({ active: true, activeFrom: null, activeTo: past })

    expect(result.key).toBe('expired')
    expect(result.type).toBe('warning')
  })

  it('active если активен и дат нет', () => {
    vi.setSystemTime(NOW)
    const result = effectivePromoStatus({ active: true, activeFrom: null, activeTo: null })

    expect(result.key).toBe('active')
    expect(result.type).toBe('success')
  })

  it('active если в пределах дат', () => {
    vi.setSystemTime(NOW)
    const past = new Date(NOW.getTime() - 86400000).toISOString()
    const future = new Date(NOW.getTime() + 86400000).toISOString()
    const result = effectivePromoStatus({ active: true, activeFrom: past, activeTo: future })

    expect(result.key).toBe('active')
  })

  it('active=false игнорирует даты', () => {
    vi.setSystemTime(NOW)
    const future = new Date(NOW.getTime() + 86400000).toISOString()
    const result = effectivePromoStatus({ active: false, activeFrom: future, activeTo: null })

    expect(result.key).toBe('inactive')
  })
})
