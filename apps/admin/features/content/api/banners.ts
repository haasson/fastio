import type { SupabaseClient } from '@supabase/supabase-js'
import type { Banner, BannerFormData } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import { optimizeImage } from '~/shared/utils/imageOptimize'

const mapBanner = (raw: Record<string, unknown>): Banner => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  url: raw.url as string,
  enabled: raw.enabled as boolean,
  sortOrder: Number(raw.sort_order),
  promotionId: raw.promotion_id as string | null,
  promoCodeId: raw.promo_code_id as string | null,
  link: raw.link as string | null,
  page: raw.page as string | null,
  content: (raw.content as string) ?? '',
  createdAt: raw.created_at as string,
})

const formToDb = (data: Partial<BannerFormData>) => ({
  ...(data.url !== undefined && { url: data.url }),
  ...(data.enabled !== undefined && { enabled: data.enabled }),
  ...(data.promotionId !== undefined && { promotion_id: data.promotionId }),
  ...(data.promoCodeId !== undefined && { promo_code_id: data.promoCodeId }),
  ...(data.link !== undefined && { link: data.link }),
  ...(data.page !== undefined && { page: data.page }),
  ...(data.content !== undefined && { content: data.content }),
})

export const bannersApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<Banner[]> {
    const data = await query(
      sb.from('banners')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true }),
    )

    return (data ?? []).map(mapBanner)
  },

  async add(sb: SupabaseClient, tenantId: string, data: BannerFormData, sortOrder: number): Promise<Banner | null> {
    const result = await query(
      sb.from('banners').insert({
        tenant_id: tenantId,
        sort_order: sortOrder,
        ...formToDb(data),
      }).select().single(),
    )

    return result ? mapBanner(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<BannerFormData>): Promise<Banner | null> {
    const result = await query(
      sb.from('banners').update(formToDb(data)).eq('id', id).select().single(),
    )

    return result ? mapBanner(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('banners').delete().eq('id', id))
  },

  async reorder(sb: SupabaseClient, items: Array<{ id: string; sortOrder: number }>): Promise<void> {
    await Promise.all(
      items.map(({ id, sortOrder }) => query(sb.from('banners').update({ sort_order: sortOrder }).eq('id', id)),
      ),
    )
  },

  async uploadImage(sb: SupabaseClient, tenantId: string, file: File, bannerId: string): Promise<string> {
    const blob = await optimizeImage(file)
    const path = `${tenantId}/banner-${bannerId}.webp`

    await query(sb.storage.from('tenant-assets').upload(path, blob, { contentType: 'image/webp', upsert: true }))

    const { publicUrl } = sb.storage.from('tenant-assets').getPublicUrl(path).data

    return `${publicUrl}?t=${Date.now()}`
  },
}
