import { describe, it, expect } from 'vitest'
import { mapDeliveryZoneRow } from '../types/delivery-zone'

const makeZoneRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'zone-1',
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
  name: 'Центр',
  color: '#FF5733',
  coordinates: [[37.60, 55.73], [37.60, 55.77], [37.64, 55.77], [37.64, 55.73]] as [number, number][],
  delivery_fee: 200,
  min_order: 500,
  free_delivery_from: 1500,
  sort_order: 0,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('mapDeliveryZoneRow', () => {
  it('маппит все поля из snake_case в camelCase', () => {
    const zone = mapDeliveryZoneRow(makeZoneRow())
    expect(zone.id).toBe('zone-1')
    expect(zone.tenantId).toBe('tenant-1')
    expect(zone.branchId).toBe('branch-1')
    expect(zone.name).toBe('Центр')
    expect(zone.color).toBe('#FF5733')
    expect(zone.deliveryFee).toBe(200)
    expect(zone.minOrder).toBe(500)
    expect(zone.freeDeliveryFrom).toBe(1500)
    expect(zone.sortOrder).toBe(0)
    expect(zone.isActive).toBe(true)
    expect(zone.createdAt).toBe('2026-01-01T00:00:00Z')
  })

  it('coordinates сохраняются как массив пар', () => {
    const zone = mapDeliveryZoneRow(makeZoneRow())
    expect(zone.coordinates).toHaveLength(4)
    expect(zone.coordinates[0]).toEqual([37.60, 55.73])
  })

  it('isActive=false — маппится', () => {
    expect(mapDeliveryZoneRow(makeZoneRow({ is_active: false })).isActive).toBe(false)
  })

  it('freeDeliveryFrom=0 — маппится (бесплатная от 0)', () => {
    expect(mapDeliveryZoneRow(makeZoneRow({ free_delivery_from: 0 })).freeDeliveryFrom).toBe(0)
  })
})
