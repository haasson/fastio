import { describe, it, expect } from 'vitest'
import { mapReservation } from '../utils/reservation'

const makeReservationRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'res-1',
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
  customer_id: null,
  guest_name: 'Иван',
  guest_phone: '79991234567',
  guest_email: null,
  guest_count: 2,
  reserved_date: '2026-03-20',
  reserved_time: '19:00:00',
  comment: null,
  status: 'pending',
  table_id: null,
  table_name: null,
  confirmed_by: null,
  confirmed_at: null,
  seated_at: null,
  cancelled_at: null,
  cancel_reason: null,
  created_at: '2026-03-15T10:00:00Z',
  updated_at: '2026-03-15T10:00:00Z',
  ...overrides,
})

describe('mapReservation', () => {
  it('маппит базовые поля', () => {
    const res = mapReservation(makeReservationRow())
    expect(res.id).toBe('res-1')
    expect(res.tenantId).toBe('tenant-1')
    expect(res.guestName).toBe('Иван')
    expect(res.guestPhone).toBe('79991234567')
    expect(res.guestCount).toBe(2)
    expect(res.reservedDate).toBe('2026-03-20')
    expect(res.status).toBe('pending')
  })

  it('reserved_time обрезается до HH:MM', () => {
    expect(mapReservation(makeReservationRow({ reserved_time: '19:00:00' })).reservedTime).toBe('19:00')
    expect(mapReservation(makeReservationRow({ reserved_time: '09:30:00' })).reservedTime).toBe('09:30')
  })

  it('nullable поля маппятся в null', () => {
    const res = mapReservation(makeReservationRow())
    expect(res.customerId).toBeNull()
    expect(res.guestEmail).toBeNull()
    expect(res.tableId).toBeNull()
    expect(res.tableName).toBeNull()
    expect(res.confirmedBy).toBeNull()
    expect(res.confirmedAt).toBeNull()
    expect(res.seatedAt).toBeNull()
    expect(res.cancelledAt).toBeNull()
    expect(res.cancelReason).toBeNull()
    expect(res.comment).toBeNull()
  })

  it('заполненные nullable поля маппятся корректно', () => {
    const res = mapReservation(makeReservationRow({
      customer_id: 'cust-1',
      guest_email: 'ivan@example.com',
      table_id: 'table-5',
      table_name: 'Стол 5',
      confirmed_by: 'admin-1',
      confirmed_at: '2026-03-15T11:00:00Z',
      cancel_reason: 'Не пришёл',
    }))
    expect(res.customerId).toBe('cust-1')
    expect(res.guestEmail).toBe('ivan@example.com')
    expect(res.tableId).toBe('table-5')
    expect(res.tableName).toBe('Стол 5')
    expect(res.confirmedBy).toBe('admin-1')
    expect(res.cancelReason).toBe('Не пришёл')
  })

  it('статусы маппятся как есть', () => {
    const statuses = ['pending', 'confirmed', 'seated', 'completed', 'cancelled']
    for (const status of statuses) {
      expect(mapReservation(makeReservationRow({ status })).status).toBe(status)
    }
  })
})
