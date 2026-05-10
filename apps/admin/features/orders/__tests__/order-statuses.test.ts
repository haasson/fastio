import { describe, it, expect } from 'vitest'
import { mapOrderStatus } from '../order-statuses'

const makeRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'status-1',
  tenant_id: 'tenant-1',
  name: 'Новый',
  group_type: 'new',
  position: 0,
  quick_actions: ['accept', 'reject'],
  ...overrides,
})

describe('mapOrderStatus', () => {
  it('маппит базовые поля', () => {
    const s = mapOrderStatus(makeRow())

    expect(s.id).toBe('status-1')
    expect(s.tenantId).toBe('tenant-1')
    expect(s.name).toBe('Новый')
    expect(s.groupType).toBe('new')
    expect(s.position).toBe(0)
  })

  it('quickActions маппится из quick_actions', () => {
    const s = mapOrderStatus(makeRow({ quick_actions: ['accept', 'reject'] }))

    expect(s.quickActions).toEqual(['accept', 'reject'])
  })

  it('quick_actions=null → пустой массив', () => {
    const s = mapOrderStatus(makeRow({ quick_actions: null }))

    expect(s.quickActions).toEqual([])
  })

  it('quick_actions отсутствует → пустой массив', () => {
    const row = makeRow()

    delete row['quick_actions']
    const s = mapOrderStatus(row)

    expect(s.quickActions).toEqual([])
  })

  it('position=0 сохраняется', () => {
    const s = mapOrderStatus(makeRow({ position: 0 }))

    expect(s.position).toBe(0)
  })

  it('position=5 сохраняется', () => {
    const s = mapOrderStatus(makeRow({ position: 5 }))

    expect(s.position).toBe(5)
  })
})
