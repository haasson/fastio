import { describe, it, expect } from 'vitest'
import { mapPromotion } from '../api/promotions'

const makePromotionRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'promo-1',
  tenant_id: 'tenant-1',
  title: 'Скидка 10%',
  type: 'min_order',
  discount_type: 'percent',
  discount_value: '10',
  conditions: {},
  active_from: null,
  active_to: null,
  active: true,
  ...overrides,
})

describe('mapPromotion', () => {
  it('маппит базовые поля', () => {
    const p = mapPromotion(makePromotionRow())

    expect(p.id).toBe('promo-1')
    expect(p.tenantId).toBe('tenant-1')
    expect(p.title).toBe('Скидка 10%')
    expect(p.type).toBe('min_order')
    expect(p.discountType).toBe('percent')
    expect(p.active).toBe(true)
  })

  it('discount_value приводится к number', () => {
    const p = mapPromotion(makePromotionRow({ discount_value: '25' }))

    expect(p.discountValue).toBe(25)
    expect(typeof p.discountValue).toBe('number')
  })

  it('active_from и active_to null → null', () => {
    const p = mapPromotion(makePromotionRow())

    expect(p.activeFrom).toBeNull()
    expect(p.activeTo).toBeNull()
  })

  it('active_from и active_to заполненные — маппятся', () => {
    const p = mapPromotion(makePromotionRow({
      active_from: '2026-03-01T00:00:00Z',
      active_to: '2026-03-31T23:59:59Z',
    }))

    expect(p.activeFrom).toBe('2026-03-01T00:00:00Z')
    expect(p.activeTo).toBe('2026-03-31T23:59:59Z')
  })

  describe('mapConditions', () => {
    it('пустые conditions → пустой объект', () => {
      const p = mapPromotion(makePromotionRow({ conditions: {} }))

      expect(p.conditions).toEqual({})
    })

    it('conditions null → пустой объект', () => {
      const p = mapPromotion(makePromotionRow({ conditions: null }))

      expect(p.conditions).toEqual({})
    })

    it('null поля в conditions НЕ попадают в результат', () => {
      const p = mapPromotion(makePromotionRow({
        conditions: { min_order_amount: null, time_from: null },
      }))

      expect('minOrderAmount' in p.conditions).toBe(false)
      expect('timeFrom' in p.conditions).toBe(false)
    })

    it('заполненные conditions маппятся в camelCase', () => {
      const p = mapPromotion(makePromotionRow({
        conditions: {
          min_order_amount: 500,
          time_from: '10:00',
          time_to: '22:00',
          weekdays: [1, 2, 3, 4, 5],
        },
      }))

      expect(p.conditions.minOrderAmount).toBe(500)
      expect(p.conditions.timeFrom).toBe('10:00')
      expect(p.conditions.timeTo).toBe('22:00')
      expect(p.conditions.weekdays).toEqual([1, 2, 3, 4, 5])
    })

    it('free_dish условие маппится', () => {
      const p = mapPromotion(makePromotionRow({
        conditions: {
          free_dish_id: 'dish-1',
          free_dish_name: 'Пицца',
          free_dish_category_name: 'Пиццы',
        },
      }))

      expect(p.conditions.freeDishId).toBe('dish-1')
      expect(p.conditions.freeDishName).toBe('Пицца')
      expect(p.conditions.freeDishCategoryName).toBe('Пиццы')
    })

    it('min_order_amount=0 ВКЛЮЧАЕТСЯ (0 != null)', () => {
      const p = mapPromotion(makePromotionRow({
        conditions: { min_order_amount: 0 },
      }))

      expect(p.conditions.minOrderAmount).toBe(0)
    })
  })
})
