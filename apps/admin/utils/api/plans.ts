import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessType, Plan, PlanFeatures } from '@fastio/shared'
import { query } from '~/utils/query'

const mapPlan = (row: Record<string, unknown>): Plan => ({
  id: row.id as string,
  key: row.key as string,
  businessType: (row.business_type as BusinessType) ?? 'retail',
  name: row.name as string,
  description: row.description as string,
  price: row.price as number,
  sortOrder: row.sort_order as number,
  isActive: row.is_active as boolean,
  features: (row.features as PlanFeatures) ?? {},
  badge: (row.badge as string | null) ?? null,
  isFeatured: (row.is_featured as boolean) ?? false,
})

export const plansApi = {
  async list(sb: SupabaseClient): Promise<Plan[]> {
    const data = await query(sb.from('plans').select('*').eq('is_active', true).order('sort_order'))

    return (data ?? []).map(mapPlan)
  },
}
