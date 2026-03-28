import { getServerSupabase } from '../utils/supabase'
import type { Banner } from '@fastio/shared'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined

  if (!tenantId) throw createError({ statusCode: 404 })

  const supabase = getServerSupabase()
  const t0 = Date.now()

  const { data } = await supabase
    .from('banners')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true })

  console.log(`[banners] done ${Date.now() - t0}ms`)

  return (data ?? []).map((row): Banner => ({
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
