import { describe, it, expect } from 'vitest'
import { mapPromoCode } from '../promo-codes'

const makePromoRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'promo-1',
  tenant_id: 'tenant-1',
  code: 'SUMMER20',
  discount_type: 'percent',
  discount_value: '20',
  usage_limit: null,
  used_count: '5',
  min_order_amount: null,
  active_from: null,
  active_to: null,
  active: true,
  ...overrides,
})

describe('mapPromoCode', () => {
  it('маппит базовые поля', () => {
    const promo = mapPromoCode(makePromoRow())

    expect(promo.id).toBe('promo-1')
    expect(promo.tenantId).toBe('tenant-1')
    expect(promo.code).toBe('SUMMER20')
    expect(promo.discountType).toBe('percent')
    expect(promo.active).toBe(true)
  })

  it('discount_value приводится к number', () => {
    const promo = mapPromoCode(makePromoRow({ discount_value: '20' }))

    expect(promo.discountValue).toBe(20)
    expect(typeof promo.discountValue).toBe('number')
  })

  it('used_count приводится к number', () => {
    const promo = mapPromoCode(makePromoRow({ used_count: '7' }))

    expect(promo.usedCount).toBe(7)
    expect(typeof promo.usedCount).toBe('number')
  })

  it('usage_limit null → null', () => {
    expect(mapPromoCode(makePromoRow({ usage_limit: null })).usageLimit).toBeNull()
  })

  it('usage_limit заполненный — приводится к number', () => {
    const promo = mapPromoCode(makePromoRow({ usage_limit: '100' }))

    expect(promo.usageLimit).toBe(100)
    expect(typeof promo.usageLimit).toBe('number')
  })

  it('min_order_amount null → null', () => {
    expect(mapPromoCode(makePromoRow({ min_order_amount: null })).minOrderAmount).toBeNull()
  })

  it('min_order_amount заполненный — приводится к number', () => {
    const promo = mapPromoCode(makePromoRow({ min_order_amount: '500' }))

    expect(promo.minOrderAmount).toBe(500)
  })

  it('active_from и active_to маппятся как строки', () => {
    const promo = mapPromoCode(makePromoRow({
      active_from: '2026-03-01T00:00:00Z',
      active_to: '2026-03-31T23:59:59Z',
    }))

    expect(promo.activeFrom).toBe('2026-03-01T00:00:00Z')
    expect(promo.activeTo).toBe('2026-03-31T23:59:59Z')
  })

  it('active_from и active_to null — остаются null', () => {
    const promo = mapPromoCode(makePromoRow({ active_from: null, active_to: null }))

    expect(promo.activeFrom).toBeNull()
    expect(promo.activeTo).toBeNull()
  })

  it('тип discount_type flat — маппится', () => {
    const promo = mapPromoCode(makePromoRow({ discount_type: 'flat' }))

    expect(promo.discountType).toBe('flat')
  })
})
