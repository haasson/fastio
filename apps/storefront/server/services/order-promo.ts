import type { SupabaseClient } from '@supabase/supabase-js'

export type PromoResult = {
  discountAmount: number
  appliedPromoCode: string | null
  appliedPromotionId: string | null
  freeItemPromo: { free_dish_id: string; dish_name: string } | null
}

export async function resolvePromo(
  supabase: SupabaseClient,
  tenantId: string,
  promoCode: string | null,
  subtotal: number,
): Promise<PromoResult> {
  const [{ data: promoResult }, { data: bestPromo }, { data: freeItemPromo }] = await Promise.all([
    promoCode
      ? supabase.rpc('check_promo_code', { p_tenant_id: tenantId, p_code: promoCode, p_subtotal: subtotal })
      : Promise.resolve({ data: null }),
    supabase.rpc('get_best_promotion', { p_tenant_id: tenantId, p_subtotal: subtotal }),
    supabase.rpc('get_free_item_promotion', { p_tenant_id: tenantId, p_subtotal: subtotal }),
  ])

  let promoCodeDiscount = 0
  if (promoResult?.valid) {
    const raw = promoResult.discount_type === 'percent'
      ? Math.round(subtotal * Number(promoResult.discount_value) / 100)
      : Number(promoResult.discount_value)
    promoCodeDiscount = Math.min(raw, subtotal)
  }

  let promotionDiscount = 0
  let appliedPromotionId: string | null = null

  if (bestPromo) {
    promotionDiscount = Number(bestPromo.discount_amount)
    appliedPromotionId = bestPromo.promotion_id as string
  }

  // Лучшая скидка побеждает
  let discountAmount: number
  let appliedPromoCode: string | null

  if (promotionDiscount > promoCodeDiscount) {
    discountAmount = promotionDiscount
    appliedPromoCode = null
  }
  else {
    discountAmount = promoCodeDiscount
    appliedPromotionId = null
    appliedPromoCode = promoCode
  }

  return {
    discountAmount,
    appliedPromoCode,
    appliedPromotionId,
    freeItemPromo: freeItemPromo as PromoResult['freeItemPromo'],
  }
}
