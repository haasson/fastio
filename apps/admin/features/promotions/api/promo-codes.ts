import type { SupabaseClient } from '@supabase/supabase-js'
import type { PromoCode, PromoCodeFormData } from '@fastio/shared'
import { query } from '~/shared/utils/query'

export const mapPromoCode = (raw: Record<string, unknown>): PromoCode => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  code: raw.code as string,
  discountType: raw.discount_type as PromoCode['discountType'],
  discountValue: Number(raw.discount_value),
  usageLimit: raw.usage_limit != null ? Number(raw.usage_limit) : null,
  usedCount: Number(raw.used_count),
  minOrderAmount: raw.min_order_amount != null ? Number(raw.min_order_amount) : null,
  activeFrom: raw.active_from as string | null,
  activeTo: raw.active_to as string | null,
  active: raw.active as boolean,
})

const formToDb = (data: Partial<PromoCodeFormData>) => ({
  ...(data.code !== undefined && { code: data.code.trim().toUpperCase() }),
  ...(data.discountType !== undefined && { discount_type: data.discountType }),
  ...(data.discountValue !== undefined && { discount_value: data.discountValue }),
  ...(data.usageLimit !== undefined && { usage_limit: data.usageLimit }),
  ...(data.minOrderAmount !== undefined && { min_order_amount: data.minOrderAmount }),
  ...(data.activeFrom !== undefined && { active_from: data.activeFrom }),
  ...(data.activeTo !== undefined && { active_to: data.activeTo }),
  ...(data.active !== undefined && { active: data.active }),
})

export const promoCodesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<PromoCode[]> {
    const data = await query(
      sb.from('promo_codes')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    )

    return (data ?? []).map(mapPromoCode)
  },

  async add(sb: SupabaseClient, tenantId: string, data: PromoCodeFormData): Promise<PromoCode | null> {
    const result = await query(
      sb.from('promo_codes').insert({
        tenant_id: tenantId,
        ...formToDb(data),
      }).select().single(),
    )

    return result ? mapPromoCode(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<PromoCodeFormData>): Promise<PromoCode | null> {
    const result = await query(
      sb.from('promo_codes').update(formToDb(data)).eq('id', id).select().single(),
    )

    return result ? mapPromoCode(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('promo_codes').update({ deleted_at: new Date().toISOString() }).eq('id', id))
  },
}
