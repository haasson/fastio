import { getServerSupabase } from '../utils/supabase'
import type { Banner, Tenant } from '@fastio/shared'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string
  const tenant = event.context.tenant as Tenant

  const supabase = getServerSupabase()
  const promoModuleEnabled = tenant.modules.promotions

  const { data } = await supabase
    .from('banners')
    .select('*, promotions:banners_promotion_id_fkey(*), promo_codes:banners_promo_code_id_fkey(*)')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true })

  const rows = (data ?? []).filter((row) => {
    // If banner links to a promotion — check module + active + not deleted
    if (row.promotion_id) {
      if (!promoModuleEnabled) return false
      const promo = row.promotions
      if (!promo || !promo.active || promo.deleted_at) return false
    }

    // If banner links to a promo code — check module + active + not deleted
    if (row.promo_code_id) {
      if (!promoModuleEnabled) return false
      const code = row.promo_codes
      if (!code || !code.active || code.deleted_at) return false
    }

    return true
  })

  return rows.map((row): Banner => ({
    id: row.id,
    tenantId: row.tenant_id,
    url: row.url,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    promotionId: row.promotion_id ?? null,
    promoCodeId: row.promo_code_id ?? null,
    link: row.link ?? null,
    page: row.page ?? null,
    content: row.content ?? '',
    createdAt: row.created_at,
  }))
})
