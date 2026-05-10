import { describe, it, expect } from 'vitest'
import { inheritAppointmentStatus } from '../utils'

describe('inheritAppointmentStatus', () => {
  it('active-визит → новая услуга confirmed', () => {
    expect(inheritAppointmentStatus('active')).toBe('confirmed')
  })

  it('request-визит → новая услуга new', () => {
    expect(inheritAppointmentStatus('request')).toBe('new')
  })

  it('cancelled-визит → fallback в new (форма редактирования всё равно read-only, но контракт держим тотальным)', () => {
    expect(inheritAppointmentStatus('cancelled')).toBe('new')
  })
})
