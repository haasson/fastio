import type { SupabaseClient } from '@supabase/supabase-js'
import { calcPromoDiscount } from './order-calc'

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

  const { discountAmount, appliedPromoCode, appliedPromotionId } = calcPromoDiscount(
    subtotal,
    promoCode,
    promoResult,
    bestPromo as { discount_amount: number; promotion_id: string } | null,
  )

  return {
    discountAmount,
    appliedPromoCode,
    appliedPromotionId,
    freeItemPromo: freeItemPromo as PromoResult['freeItemPromo'],
  }
}
