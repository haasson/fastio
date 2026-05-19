import { describe, it, expect } from 'vitest'
import { formatStaffName, mapAppointment } from '../utils/appointment'

const makeAppointmentRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'appt-1',
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
  group_id: null,
  service_id: 'svc-1',
  service_name: 'Стрижка',
  service_price: 1500,
  resource_id: 'res-1',
  user_id: 'user-1',
  customer_id: null,
  customer_name: 'Иван Петров',
  customer_phone: '79991234567',
  starts_at: '2026-03-15T10:00:00Z',
  ends_at: '2026-03-15T11:00:00Z',
  actual_ends_at: null,
  booking_mode: 'fixed',
  status: 'new',
  resource_assigned_by: null,
  notes: null,
  cancel_reason: null,
  cancelled_by: null,
  cancelled_at: null,
  confirmed_at: null,
  confirmed_by: null,
  created_at: '2026-03-15T09:00:00Z',
  updated_at: '2026-03-15T09:00:00Z',
  ...overrides,
})

describe('mapAppointment', () => {
  it('маппит базовые поля', () => {
    const a = mapAppointment(makeAppointmentRow())

    expect(a.id).toBe('appt-1')
    expect(a.tenantId).toBe('tenant-1')
    expect(a.branchId).toBe('branch-1')
    expect(a.serviceId).toBe('svc-1')
    expect(a.serviceName).toBe('Стрижка')
    expect(a.servicePrice).toBe(1500)
    expect(a.customerName).toBe('Иван Петров')
    expect(a.customerPhone).toBe('79991234567')
    expect(a.status).toBe('new')
    expect(a.bookingMode).toBe('fixed')
  })

  it('group_id null → null', () => {
    const a = mapAppointment(makeAppointmentRow({ group_id: null }))

    expect(a.groupId).toBeNull()
  })

  it('service_name null → пустая строка', () => {
    const a = mapAppointment(makeAppointmentRow({ service_name: null }))

    expect(a.serviceName).toBe('')
  })

  it('service_price null → 0', () => {
    const a = mapAppointment(makeAppointmentRow({ service_price: null }))

    expect(a.servicePrice).toBe(0)
  })

  it('booking_mode null → "fixed"', () => {
    const a = mapAppointment(makeAppointmentRow({ booking_mode: null }))

    expect(a.bookingMode).toBe('fixed')
  })

  it('actual_ends_at null → null', () => {
    const a = mapAppointment(makeAppointmentRow({ actual_ends_at: null }))

    expect(a.actualEndsAt).toBeNull()
  })

  it('actual_ends_at заполнен — маппится', () => {
    const a = mapAppointment(makeAppointmentRow({ actual_ends_at: '2026-03-15T11:30:00Z' }))

    expect(a.actualEndsAt).toBe('2026-03-15T11:30:00Z')
  })

  it('notes null → null', () => {
    const a = mapAppointment(makeAppointmentRow({ notes: null }))

    expect(a.notes).toBeNull()
  })

  it('cancel_reason null → null', () => {
    const a = mapAppointment(makeAppointmentRow({ cancel_reason: null }))

    expect(a.cancelReason).toBeNull()
  })

  it('cancelled статус маппится с timestamp', () => {
    const a = mapAppointment(makeAppointmentRow({
      status: 'cancelled',
      cancelled_at: '2026-03-15T10:05:00Z',
      cancelled_by: 'user-2',
      cancel_reason: 'Клиент передумал',
    }))

    expect(a.status).toBe('cancelled')
    expect(a.cancelledAt).toBe('2026-03-15T10:05:00Z')
    expect(a.cancelledBy).toBe('user-2')
    expect(a.cancelReason).toBe('Клиент передумал')
  })
})

describe('formatStaffName', () => {
  describe('full_name', () => {
    it('full_name → имя как есть', () => {
      expect(formatStaffName('Анна Краснова', 'full_name')).toBe('Анна Краснова')
    })

    it('одно слово с full_name — остаётся', () => {
      expect(formatStaffName('Анна', 'full_name')).toBe('Анна')
    })
  })

  describe('first_name', () => {
    it('возвращает только первое слово', () => {
      expect(formatStaffName('Анна Краснова', 'first_name')).toBe('Анна')
    })

    it('одно слово — возвращает как есть', () => {
      expect(formatStaffName('Анна', 'first_name')).toBe('Анна')
    })

    it('три слова — возвращает первое', () => {
      expect(formatStaffName('Анна Ивановна Краснова', 'first_name')).toBe('Анна')
    })
  })

  describe('first_name_last_initial', () => {
    it('имя + фамилия → "Имя Ф."', () => {
      expect(formatStaffName('Анна Краснова', 'first_name_last_initial')).toBe('Анна К.')
    })

    it('только имя → возвращает имя', () => {
      expect(formatStaffName('Анна', 'first_name_last_initial')).toBe('Анна')
    })

    it('двойные пробелы — не ломается', () => {
      const result = formatStaffName('Анна  Краснова', 'first_name_last_initial')

      expect(result).toBe('Анна К.')
    })

    it('три слова — берёт первое + инициал второго', () => {
      expect(formatStaffName('Анна Ивановна Краснова', 'first_name_last_initial')).toBe('Анна И.')
    })
  })
})
