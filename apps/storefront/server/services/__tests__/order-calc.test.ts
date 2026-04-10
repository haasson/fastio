import { describe, it, expect } from 'vitest'
import { calcSubtotal, calcPromoDiscount, calcDeliveryFee, calcOrderTotal } from '../order-calc'

describe('calcSubtotal', () => {
  it('sums items by price * quantity', () => {
    expect(calcSubtotal([
      { price: 300, quantity: 2 },
      { price: 150, quantity: 1 },
    ])).toBe(750)
  })

  it('includes modifier price deltas', () => {
    expect(calcSubtotal([
      { price: 300, quantity: 1, modifiers: [{ priceDelta: 50 }, { priceDelta: -20 }] },
    ])).toBe(330) // 300 + 50 - 20
  })

  it('multiplies modifiers by quantity', () => {
    expect(calcSubtotal([
      { price: 200, quantity: 3, modifiers: [{ priceDelta: 30 }] },
    ])).toBe(690) // (200 + 30) * 3
  })

  it('returns 0 for empty items', () => {
    expect(calcSubtotal([])).toBe(0)
  })

  it('handles items without modifiers', () => {
    expect(calcSubtotal([
      { price: 500, quantity: 1 },
    ])).toBe(500)
  })

  it('handles items with empty modifiers array', () => {
    expect(calcSubtotal([
      { price: 500, quantity: 1, modifiers: [] },
    ])).toBe(500)
  })
})

describe('calcPromoDiscount', () => {
  it('returns 0 when no promo and no auto-promotion', () => {
    const result = calcPromoDiscount(1000, null, null, null)
    expect(result).toEqual({ discountAmount: 0, appliedPromoCode: null, appliedPromotionId: null })
  })

  it('applies percent promo code', () => {
    const result = calcPromoDiscount(
      1000,
      'SALE10',
      { valid: true, discount_type: 'percent', discount_value: 10 },
      null,
    )
    expect(result).toEqual({ discountAmount: 100, appliedPromoCode: 'SALE10', appliedPromotionId: null })
  })

  it('applies fixed promo code', () => {
    const result = calcPromoDiscount(
      1000,
      'FIXED200',
      { valid: true, discount_type: 'fixed', discount_value: 200 },
      null,
    )
    expect(result).toEqual({ discountAmount: 200, appliedPromoCode: 'FIXED200', appliedPromotionId: null })
  })

  it('caps promo code discount at subtotal', () => {
    const result = calcPromoDiscount(
      100,
      'BIG',
      { valid: true, discount_type: 'fixed', discount_value: 500 },
      null,
    )
    expect(result.discountAmount).toBe(100)
  })

  it('rounds percent discount', () => {
    const result = calcPromoDiscount(
      333,
      'PCT',
      { valid: true, discount_type: 'percent', discount_value: 10 },
      null,
    )
    expect(result.discountAmount).toBe(33) // Math.round(33.3)
  })

  it('ignores invalid promo code', () => {
    const result = calcPromoDiscount(
      1000,
      'EXPIRED',
      { valid: false },
      null,
    )
    expect(result).toEqual({ discountAmount: 0, appliedPromoCode: null, appliedPromotionId: null })
  })

  it('applies auto-promotion when no promo code', () => {
    const result = calcPromoDiscount(
      1000,
      null,
      null,
      { discount_amount: 150, promotion_id: 'promo-1' },
    )
    expect(result).toEqual({ discountAmount: 150, appliedPromoCode: null, appliedPromotionId: 'promo-1' })
  })

  it('auto-promotion wins when bigger than promo code', () => {
    const result = calcPromoDiscount(
      1000,
      'SMALL',
      { valid: true, discount_type: 'fixed', discount_value: 50 },
      { discount_amount: 200, promotion_id: 'promo-1' },
    )
    expect(result).toEqual({ discountAmount: 200, appliedPromoCode: null, appliedPromotionId: 'promo-1' })
  })

  it('promo code wins when bigger than auto-promotion', () => {
    const result = calcPromoDiscount(
      1000,
      'BIG50',
      { valid: true, discount_type: 'percent', discount_value: 50 },
      { discount_amount: 100, promotion_id: 'promo-1' },
    )
    expect(result).toEqual({ discountAmount: 500, appliedPromoCode: 'BIG50', appliedPromotionId: null })
  })

  it('promo code wins on equal discount (tie goes to promo code)', () => {
    const result = calcPromoDiscount(
      1000,
      'TIE',
      { valid: true, discount_type: 'fixed', discount_value: 200 },
      { discount_amount: 200, promotion_id: 'promo-1' },
    )
    expect(result).toEqual({ discountAmount: 200, appliedPromoCode: 'TIE', appliedPromotionId: null })
  })
})

describe('calcDeliveryFee', () => {
  it('returns 0 for pickup', () => {
    const result = calcDeliveryFee({
      deliveryType: 'pickup',
      deliveryMode: 'zones',
      matchedZone: null,
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 0, minOrder: 500 },
      subtotal: 1000,
    })
    expect(result).toEqual({ deliveryFee: 0, minOrder: 0 })
  })

  it('returns 0 for dine_in', () => {
    const result = calcDeliveryFee({
      deliveryType: 'dine_in',
      deliveryMode: 'zones',
      matchedZone: null,
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 0, minOrder: 500 },
      subtotal: 1000,
    })
    expect(result).toEqual({ deliveryFee: 0, minOrder: 0 })
  })

  it('fixed mode: uses tenant fee regardless of zone', () => {
    const result = calcDeliveryFee({
      deliveryType: 'delivery',
      deliveryMode: 'fixed',
      matchedZone: null,
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 0, minOrder: 500 },
      subtotal: 1000,
    })
    expect(result).toEqual({ deliveryFee: 200, minOrder: 500 })
  })

  it('fixed mode: free delivery when subtotal >= freeDeliveryFrom', () => {
    const result = calcDeliveryFee({
      deliveryType: 'delivery',
      deliveryMode: 'fixed',
      matchedZone: null,
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 1000, minOrder: 500 },
      subtotal: 1500,
    })
    expect(result).toEqual({ deliveryFee: 0, minOrder: 500 })
  })

  it('fixed mode: charges fee when subtotal < freeDeliveryFrom', () => {
    const result = calcDeliveryFee({
      deliveryType: 'delivery',
      deliveryMode: 'fixed',
      matchedZone: null,
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 2000, minOrder: 500 },
      subtotal: 1500,
    })
    expect(result).toEqual({ deliveryFee: 200, minOrder: 500 })
  })

  it('zones mode: returns 0 when no zone matched', () => {
    const result = calcDeliveryFee({
      deliveryType: 'delivery',
      deliveryMode: 'zones',
      matchedZone: null,
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 0, minOrder: 500 },
      subtotal: 1000,
    })
    expect(result).toEqual({ deliveryFee: 0, minOrder: 0 })
  })

  it('zones mode: uses zone fee when zone matched', () => {
    const result = calcDeliveryFee({
      deliveryType: 'delivery',
      deliveryMode: 'zones',
      matchedZone: { deliveryFee: 300, freeDeliveryFrom: 0, minOrder: 800 },
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 0, minOrder: 500 },
      subtotal: 1000,
    })
    expect(result).toEqual({ deliveryFee: 300, minOrder: 800 })
  })

  it('free delivery when subtotal >= freeDeliveryFrom', () => {
    const result = calcDeliveryFee({
      deliveryType: 'delivery',
      deliveryMode: 'zones',
      matchedZone: { deliveryFee: 300, freeDeliveryFrom: 1000, minOrder: 500 },
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 0, minOrder: 500 },
      subtotal: 1500,
    })
    expect(result).toEqual({ deliveryFee: 0, minOrder: 500 })
  })

  it('charges delivery when subtotal < freeDeliveryFrom', () => {
    const result = calcDeliveryFee({
      deliveryType: 'delivery',
      deliveryMode: 'zones',
      matchedZone: { deliveryFee: 300, freeDeliveryFrom: 2000, minOrder: 500 },
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 0, minOrder: 500 },
      subtotal: 1500,
    })
    expect(result).toEqual({ deliveryFee: 300, minOrder: 500 })
  })

  it('free delivery when subtotal equals freeDeliveryFrom exactly', () => {
    const result = calcDeliveryFee({
      deliveryType: 'delivery',
      deliveryMode: 'zones',
      matchedZone: { deliveryFee: 300, freeDeliveryFrom: 1000, minOrder: 500 },
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 0, minOrder: 500 },
      subtotal: 1000,
    })
    expect(result).toEqual({ deliveryFee: 0, minOrder: 500 })
  })

  it('freeDeliveryFrom = 0 means no free delivery threshold', () => {
    const result = calcDeliveryFee({
      deliveryType: 'delivery',
      deliveryMode: 'zones',
      matchedZone: { deliveryFee: 300, freeDeliveryFrom: 0, minOrder: 500 },
      tenantDelivery: { deliveryFee: 200, freeDeliveryFrom: 0, minOrder: 500 },
      subtotal: 50000,
    })
    expect(result).toEqual({ deliveryFee: 300, minOrder: 500 })
  })
})

describe('calcOrderTotal', () => {
  it('calculates total = subtotal - discount + delivery', () => {
    expect(calcOrderTotal(1000, 100, 200)).toBe(1100)
  })

  it('handles zero discount and delivery', () => {
    expect(calcOrderTotal(500, 0, 0)).toBe(500)
  })

  it('handles discount equal to subtotal', () => {
    expect(calcOrderTotal(1000, 1000, 0)).toBe(0)
  })
})
