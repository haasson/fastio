export type CalcItem = {
  price: number
  quantity: number
  modifiers?: { priceDelta: number }[]
}

export function calcSubtotal(items: CalcItem[]): number {
  return items.reduce(
    (sum, item) =>
      sum + (item.price + (item.modifiers?.reduce((s, m) => s + m.priceDelta, 0) ?? 0)) * item.quantity,
    0,
  )
}

export type PromoCodeResult = {
  valid: boolean
  discount_type?: 'percent' | 'fixed'
  discount_value?: number
}

export type AutoPromoResult = {
  discount_amount: number
  promotion_id: string
} | null

export type FreeItemResult = {
  free_dish_id: string
  dish_name: string
} | null

export function calcPromoDiscount(
  subtotal: number,
  promoCode: string | null,
  promoResult: PromoCodeResult | null,
  bestPromo: AutoPromoResult,
): {
  discountAmount: number
  appliedPromoCode: string | null
  appliedPromotionId: string | null
} {
  // Расчёт скидки по промокоду
  let promoCodeDiscount = 0
  if (promoResult?.valid) {
    const raw = promoResult.discount_type === 'percent'
      ? Math.round(subtotal * Number(promoResult.discount_value) / 100)
      : Number(promoResult.discount_value)
    promoCodeDiscount = Math.min(raw, subtotal)
  }

  // Автоматическая акция
  let promotionDiscount = 0
  let appliedPromotionId: string | null = null

  if (bestPromo) {
    promotionDiscount = Number(bestPromo.discount_amount)
    appliedPromotionId = bestPromo.promotion_id
  }

  // Лучшая скидка побеждает
  if (promotionDiscount > promoCodeDiscount) {
    return { discountAmount: promotionDiscount, appliedPromoCode: null, appliedPromotionId }
  }

  return {
    discountAmount: promoCodeDiscount,
    appliedPromoCode: promoCodeDiscount > 0 ? promoCode : null,
    appliedPromotionId: null,
  }
}

export type DeliveryFeeInput = {
  deliveryType: string
  matchedZone: { deliveryFee: number; freeDeliveryFrom: number; minOrder: number } | null
  tenantDeliveryFee: number
  tenantMinOrder: number
  subtotal: number
}

export function calcDeliveryFee(input: DeliveryFeeInput): {
  deliveryFee: number
  minOrder: number
} {
  const { deliveryType, matchedZone, tenantDeliveryFee, tenantMinOrder, subtotal } = input

  if (deliveryType !== 'delivery') {
    return { deliveryFee: 0, minOrder: 0 }
  }

  const zoneDeliveryFee = matchedZone
    ? (matchedZone.freeDeliveryFrom > 0 && subtotal >= matchedZone.freeDeliveryFrom ? 0 : matchedZone.deliveryFee)
    : null

  const deliveryFee = zoneDeliveryFee !== null ? zoneDeliveryFee : tenantDeliveryFee
  const minOrder = matchedZone ? matchedZone.minOrder : tenantMinOrder

  return { deliveryFee, minOrder }
}

export function calcOrderTotal(subtotal: number, discountAmount: number, deliveryFee: number): number {
  return subtotal - discountAmount + deliveryFee
}
