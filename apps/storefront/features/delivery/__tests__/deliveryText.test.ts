import { describe, it, expect } from 'vitest'
import { buildDeliveryText, formatZoneConditions } from '../utils/deliveryText'
import type { DeliveryZone, Tenant } from '@fastio/shared'

const makeZone = (overrides: Partial<DeliveryZone> = {}): DeliveryZone => ({
  id: 'z1',
  tenantId: 't1',
  branchId: 'b1',
  name: 'Центр',
  color: '#000',
  coordinates: [],
  deliveryFee: 200,
  minOrder: 500,
  freeDeliveryFrom: 0,
  sortOrder: 0,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant =>
  ({ deliveryFee: 0, deliveryMinOrder: 0, ...overrides } as Tenant)

describe('formatZoneConditions', () => {
  it('fee=0 → "Бесплатная доставка"', () => {
    expect(formatZoneConditions(makeZone({ deliveryFee: 0 }), '₽')).toBe('Бесплатная доставка')
  })

  it('fee>0, без freeFrom и minOrder', () => {
    const result = formatZoneConditions(makeZone({ deliveryFee: 200, freeDeliveryFrom: 0, minOrder: 0 }), '₽')
    expect(result).toContain('200')
    expect(result).not.toContain('бесплатно')
    expect(result).not.toContain('Минимальный')
  })

  it('fee>0, с freeFrom → добавляет текст про бесплатную', () => {
    const result = formatZoneConditions(makeZone({ deliveryFee: 200, freeDeliveryFrom: 1500, minOrder: 0 }), '₽')
    expect(result).toContain('200')
    expect(result).toContain('1500')
    expect(result).toContain('бесплатно')
  })

  it('fee>0, с minOrder → добавляет минимальный заказ', () => {
    const result = formatZoneConditions(makeZone({ deliveryFee: 150, freeDeliveryFrom: 0, minOrder: 500 }), '₽')
    expect(result).toContain('150')
    expect(result).toContain('500')
    expect(result).toContain('Минимальный')
  })

  it('валюта подставляется', () => {
    const result = formatZoneConditions(makeZone({ deliveryFee: 100 }), 'руб.')
    expect(result).toContain('руб.')
  })
})

describe('buildDeliveryText', () => {
  it('нет активных зон → используются настройки тенанта', () => {
    const inactive = makeZone({ isActive: false, deliveryFee: 999 })
    const tenant = makeTenant({ deliveryFee: 0 })
    expect(buildDeliveryText([inactive], tenant, '₽')).toBe('Бесплатная доставка')
  })

  it('нет зон вообще → используются настройки тенанта', () => {
    const tenant = makeTenant({ deliveryFee: 300, deliveryMinOrder: 600 })
    const result = buildDeliveryText([], tenant, '₽')
    expect(result).toContain('300')
    expect(result).toContain('600')
  })

  it('все активные зоны одинаковые → единый текст', () => {
    const zones = [
      makeZone({ deliveryFee: 100, freeDeliveryFrom: 1000 }),
      makeZone({ id: 'z2', deliveryFee: 100, freeDeliveryFrom: 1000 }),
    ]
    const result = buildDeliveryText(zones, makeTenant(), '₽')
    expect(result).toContain('100')
    expect(result).not.toContain('зависит от')
  })

  it('активные зоны с разной ценой → общий текст про адрес', () => {
    const zones = [
      makeZone({ deliveryFee: 100 }),
      makeZone({ id: 'z2', deliveryFee: 200 }),
    ]
    const result = buildDeliveryText(zones, makeTenant(), '₽')
    expect(result).toContain('зависит от')
    expect(result).not.toContain('100')
  })

  it('одна зона с fee=0 → "Бесплатная доставка"', () => {
    const zones = [makeZone({ deliveryFee: 0 })]
    expect(buildDeliveryText(zones, makeTenant(), '₽')).toBe('Бесплатная доставка')
  })

  it('смесь активных и неактивных → считаются только активные', () => {
    const zones = [
      makeZone({ deliveryFee: 100, isActive: true }),
      makeZone({ id: 'z2', deliveryFee: 200, isActive: false }),
    ]
    // Только одна активная → однородные → конкретный текст
    const result = buildDeliveryText(zones, makeTenant(), '₽')
    expect(result).toContain('100')
    expect(result).not.toContain('зависит от')
  })
})
