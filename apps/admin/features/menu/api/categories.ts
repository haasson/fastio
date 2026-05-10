import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, CategoryData, CategoryKind, CategoryType } from '@fastio/shared'
import { mapCategory } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import { filterDefined } from '~/shared/utils/filterDefined'
import { optimizeImage } from '~/shared/utils/imageOptimize'

type CategoryAddPayload = Required<Pick<CategoryData, 'name' | 'order'>> & CategoryData & { type?: CategoryType; kind: CategoryKind }

export const categoriesApi = {
  async list(sb: SupabaseClient, tenantId: string, kind: CategoryKind = 'food') {
    const data = await query(sb.from('categories').select('*').eq('tenant_id', tenantId).eq('kind', kind).is('deleted_at', null).order('sort_order'))

    return (data ?? []).map(mapCategory)
  },

  async add(sb: SupabaseClient, tenantId: string, payload: CategoryAddPayload): Promise<Category | null> {
    const data = await query(sb.from('categories').insert({
      tenant_id: tenantId,
      name: payload.name,
      type: payload.type ?? 'regular',
      kind: payload.kind,
      sort_order: payload.order,
      active: true,
      ...filterDefined({ photo_url: payload.photoUrl, use_first_dish_photo: payload.useFirstDishPhoto, tag_id: payload.tagId, slug: payload.slug, color: payload.color }),
    }).select().single())

    return data ? mapCategory(data) : null
  },

  async update(sb: SupabaseClient, id: string, data: CategoryData): Promise<Category | null> {
    const result = await query(sb.from('categories').update(
      filterDefined({
        name: data.name,
        active: data.active,
        sort_order: data.order,
        photo_url: data.photoUrl,
        use_first_dish_photo: data.useFirstDishPhoto,
        tag_id: data.tagId,
        slug: data.slug,
        color: data.color,
      }),
    ).eq('id', id).select().single())

    return result ? mapCategory(result) : null
  },

  async remove(sb: SupabaseClient, id: string) {
    await query(sb.from('categories').update({ deleted_at: new Date().toISOString() }).eq('id', id))
  },

  async reorder(sb: SupabaseClient, items: { id: string; order: number }[]) {
    await Promise.all(
      items.map(({ id, order }) => query(sb.from('categories').update({ sort_order: order }).eq('id', id))),
    )
  },

  async uploadPhoto(sb: SupabaseClient, tenantId: string, file: File): Promise<string> {
    const blob = await optimizeImage(file)
    const path = `${tenantId}/${crypto.randomUUID()}.webp`

    await query(sb.storage.from('dish-images').upload(path, blob, { contentType: 'image/webp' }))

    return sb.storage.from('dish-images').getPublicUrl(path).data.publicUrl
  },

  async deletePhoto(sb: SupabaseClient, url: string): Promise<void> {
    const marker = '/dish-images/'
    const idx = url.indexOf(marker)

    if (idx === -1) return

    const path = url.substring(idx + marker.length)

    await query(sb.storage.from('dish-images').remove([path]))
  },
}
