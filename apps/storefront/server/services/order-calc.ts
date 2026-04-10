export type CalcItem = {
  price: number
  quantity: number
  modifiers?: { priceDelta: number }[]
  addons?: { price: number }[]
}

export function calcSubtotal(items: CalcItem[]): number {
  return items.reduce(
    (sum, item) =>
      sum + (item.price
        + (item.modifiers?.reduce((s, m) => s + m.priceDelta, 0) ?? 0)
        + (item.addons?.reduce((s, a) => s + a.price, 0) ?? 0)
      ) * item.quantity,
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

export type DeliveryParams = {
  deliveryFee: number
  freeDeliveryFrom: number
  minOrder: number
}

export type DeliveryFeeInput = {
  deliveryType: string
  deliveryMode: string
  matchedZone: DeliveryParams | null
  tenantDelivery: DeliveryParams
  subtotal: number
}

export function calcDeliveryFee(input: DeliveryFeeInput): {
  deliveryFee: number
  minOrder: number
} {
  const { deliveryType, deliveryMode, matchedZone, tenantDelivery, subtotal } = input

  if (deliveryType !== 'delivery') {
    return { deliveryFee: 0, minOrder: 0 }
  }

  const params = deliveryMode === 'fixed' ? tenantDelivery : matchedZone
  if (!params) return { deliveryFee: 0, minOrder: 0 }

  const fee = params.freeDeliveryFrom > 0 && subtotal >= params.freeDeliveryFrom ? 0 : params.deliveryFee
  return { deliveryFee: fee, minOrder: params.minOrder }
}

export function calcOrderTotal(subtotal: number, discountAmount: number, deliveryFee: number): number {
  return subtotal - discountAmount + deliveryFee
}
