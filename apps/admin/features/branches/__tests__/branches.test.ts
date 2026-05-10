import { describe, it, expect } from 'vitest'
import { mapBranch } from '../api/branches'

const makeBranchRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'branch-1',
  tenant_id: 'tenant-1',
  name: 'Центральный',
  color: '#FF5733',
  address: 'ул. Ленина 1',
  phone: '+7 999 123-45-67',
  is_active: true,
  working_hours_schedule: { default: { open: '10:00', close: '22:00' }, days: {} },
  delivery_min_order: 500,
  delivery_fee: 100,
  notifications: null,
  latitude: 55.75,
  longitude: 37.61,
  order_number_prefix: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
  ...overrides,
})

describe('mapBranch', () => {
  it('маппит базовые поля', () => {
    const branch = mapBranch(makeBranchRow())

    expect(branch.id).toBe('branch-1')
    expect(branch.tenantId).toBe('tenant-1')
    expect(branch.name).toBe('Центральный')
    expect(branch.color).toBe('#FF5733')
    expect(branch.address).toBe('ул. Ленина 1')
    expect(branch.phone).toBe('+7 999 123-45-67')
    expect(branch.isActive).toBe(true)
  })

  it('маппит рабочие часы как объект', () => {
    const branch = mapBranch(makeBranchRow())

    expect(branch.workingHoursSchedule).toEqual({ default: { open: '10:00', close: '22:00' }, days: {} })
  })

  it('маппит координаты', () => {
    const branch = mapBranch(makeBranchRow())

    expect(branch.latitude).toBe(55.75)
    expect(branch.longitude).toBe(37.61)
  })

  it('order_number_prefix null → null', () => {
    expect(mapBranch(makeBranchRow({ order_number_prefix: null })).orderNumberPrefix).toBeNull()
  })

  it('order_number_prefix заполненный — маппится', () => {
    expect(mapBranch(makeBranchRow({ order_number_prefix: 'ЦЛ' })).orderNumberPrefix).toBe('ЦЛ')
  })

  it('archived_at null → null', () => {
    expect(mapBranch(makeBranchRow({ archived_at: null })).archivedAt).toBeNull()
  })

  it('archived_at заполненный — маппится', () => {
    const branch = mapBranch(makeBranchRow({ archived_at: '2026-03-01T00:00:00Z' }))

    expect(branch.archivedAt).toBe('2026-03-01T00:00:00Z')
  })

  it('delivery_min_order и delivery_fee маппятся', () => {
    const branch = mapBranch(makeBranchRow({ delivery_min_order: 1000, delivery_fee: 200 }))

    expect(branch.deliveryMinOrder).toBe(1000)
    expect(branch.deliveryFee).toBe(200)
  })

  it('created_at и updated_at маппятся', () => {
    const branch = mapBranch(makeBranchRow())

    expect(branch.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(branch.updatedAt).toBe('2026-01-01T00:00:00Z')
  })
})
