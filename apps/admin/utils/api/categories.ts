import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, CategoryData } from '@fastio/shared'
import { query } from '~/utils/query'
import type { CategoryRow } from './db-types'
import { filterDefined } from '~/utils/filterDefined'
import { optimizeImage } from '~/utils/imageOptimize'

type CategoryAddPayload = Required<Pick<CategoryData, 'name' | 'order'>> & CategoryData

export const mapCategory = (raw: Record<string, unknown>): Category => {
  const row = raw as CategoryRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    order: row.sort_order,
    active: row.active,
    photoUrl: row.photo_url,
    useFirstDishPhoto: row.use_first_dish_photo ?? false,
  }
}

export const categoriesApi = {
  async list(sb: SupabaseClient, tenantId: string) {
    const data = await query(sb.from('categories').select('*').eq('tenant_id', tenantId).order('sort_order'))

    return (data ?? []).map(mapCategory)
  },

  async add(sb: SupabaseClient, tenantId: string, payload: CategoryAddPayload): Promise<Category | null> {
    const data = await query(sb.from('categories').insert({
      tenant_id: tenantId,
      name: payload.name,
      sort_order: payload.order,
      active: true,
      ...filterDefined({ photo_url: payload.photoUrl, use_first_dish_photo: payload.useFirstDishPhoto }),
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
      }),
    ).eq('id', id).select().single())

    return result ? mapCategory(result) : null
  },

  async remove(sb: SupabaseClient, id: string) {
    await query(sb.from('categories').delete().eq('id', id))
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
