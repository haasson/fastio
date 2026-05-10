import type { SupabaseClient } from '@supabase/supabase-js'
import type { Promotion, PromotionFormData, PromotionConditions, OrderItemModifier } from '@fastio/shared'
import { query } from '~/shared/utils/query'

const mapConditions = (raw: Record<string, unknown>): PromotionConditions => ({
  ...(raw.min_order_amount != null && { minOrderAmount: Number(raw.min_order_amount) }),
  ...(raw.time_from != null && { timeFrom: raw.time_from as string }),
  ...(raw.time_to != null && { timeTo: raw.time_to as string }),
  ...(raw.weekdays != null && { weekdays: raw.weekdays as number[] }),
  ...(raw.free_dish_id != null && { freeDishId: raw.free_dish_id as string }),
  ...(raw.free_dish_name != null && { freeDishName: raw.free_dish_name as string }),
  ...(raw.free_dish_category_name != null && { freeDishCategoryName: raw.free_dish_category_name as string }),
  ...(raw.free_dish_modifiers != null && { freeDishModifiers: raw.free_dish_modifiers as OrderItemModifier[] }),
})

const conditionsToDb = (c: PromotionConditions) => ({
  ...(c.minOrderAmount != null && { min_order_amount: c.minOrderAmount }),
  ...(c.timeFrom != null && { time_from: c.timeFrom }),
  ...(c.timeTo != null && { time_to: c.timeTo }),
  ...(c.weekdays != null && { weekdays: c.weekdays }),
  ...(c.freeDishId != null && { free_dish_id: c.freeDishId }),
  ...(c.freeDishName != null && { free_dish_name: c.freeDishName }),
  ...(c.freeDishCategoryName != null && { free_dish_category_name: c.freeDishCategoryName }),
  ...(c.freeDishModifiers != null && { free_dish_modifiers: c.freeDishModifiers }),
})

export const mapPromotion = (raw: Record<string, unknown>): Promotion => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  title: raw.title as string,
  type: raw.type as Promotion['type'],
  discountType: raw.discount_type as Promotion['discountType'],
  discountValue: Number(raw.discount_value),
  conditions: mapConditions((raw.conditions as Record<string, unknown>) ?? {}),
  activeFrom: raw.active_from as string | null,
  activeTo: raw.active_to as string | null,
  active: raw.active as boolean,
})

const formToDb = (data: Partial<PromotionFormData>) => ({
  ...(data.title !== undefined && { title: data.title }),
  ...(data.type !== undefined && { type: data.type }),
  ...(data.discountType !== undefined && { discount_type: data.discountType }),
  ...(data.discountValue !== undefined && { discount_value: data.discountValue }),
  ...(data.conditions !== undefined && { conditions: conditionsToDb(data.conditions) }),
  ...(data.activeFrom !== undefined && { active_from: data.activeFrom }),
  ...(data.activeTo !== undefined && { active_to: data.activeTo }),
  ...(data.active !== undefined && { active: data.active }),
})

export const promotionsApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<Promotion[]> {
    const data = await query(
      sb.from('promotions')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    )

    return (data ?? []).map(mapPromotion)
  },

  async add(sb: SupabaseClient, tenantId: string, data: PromotionFormData): Promise<Promotion | null> {
    const result = await query(
      sb.from('promotions').insert({
        tenant_id: tenantId,
        ...formToDb(data),
      }).select().single(),
    )

    return result ? mapPromotion(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<PromotionFormData>): Promise<Promotion | null> {
    const result = await query(
      sb.from('promotions').update(formToDb(data)).eq('id', id).select().single(),
    )

    return result ? mapPromotion(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('promotions').update({ deleted_at: new Date().toISOString() }).eq('id', id))
  },
}
