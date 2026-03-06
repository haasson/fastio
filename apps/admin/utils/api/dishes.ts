import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dish, DishBranchPrice } from '@fastio/shared'
import { query } from '~/utils/query'
import type { DishRow, DishBranchPriceRow } from './db-types'
import { filterDefined } from '~/utils/filterDefined'
import { optimizeImage } from '~/utils/imageOptimize'

export type DishFormData = Omit<Dish, 'id' | 'tenantId'>

export const mapDish = (raw: Record<string, unknown>): Dish => {
  const row = raw as DishRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: row.price,
    photos: row.photos,
    ingredients: row.ingredients,
    nutrition: row.nutrition,
    tags: row.tags,
    active: row.active,
    order: row.sort_order,
  }
}

export const dishesApi = {
  async listAllActive(sb: SupabaseClient, tenantId: string): Promise<Dish[]> {
    const data = await query(
      sb.from('dishes').select('*').eq('tenant_id', tenantId).eq('active', true).order('name'),
    )

    return (data ?? []).map(mapDish)
  },

  async list(sb: SupabaseClient, tenantId: string, categoryId: string) {
    const data = await query(sb.from('dishes').select('*').eq('tenant_id', tenantId).eq('category_id', categoryId).order('sort_order'))

    return (data ?? []).map(mapDish)
  },

  async add(sb: SupabaseClient, tenantId: string, data: DishFormData): Promise<Dish | null> {
    const result = await query(sb.from('dishes').insert({
      tenant_id: tenantId,
      category_id: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price,
      photos: data.photos ?? [],
      ingredients: data.ingredients,
      nutrition: data.nutrition,
      tags: data.tags,
      active: data.active,
      sort_order: data.order,
    }).select().single())

    return result ? mapDish(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<DishFormData>): Promise<Dish | null> {
    const result = await query(sb.from('dishes').update(
      filterDefined({
        name: data.name,
        description: data.description,
        price: data.price,
        category_id: data.categoryId,
        ingredients: data.ingredients,
        nutrition: data.nutrition,
        tags: data.tags,
        active: data.active,
        sort_order: data.order,
        photos: data.photos,
      }),
    ).eq('id', id).select().single())

    return result ? mapDish(result) : null
  },

  async remove(sb: SupabaseClient, id: string) {
    await query(sb.from('dishes').delete().eq('id', id))
  },

  async reorder(sb: SupabaseClient, items: { id: string; order: number }[]) {
    await query(sb.rpc('reorder_dishes', { items }))
  },

  async toggleActive(sb: SupabaseClient, id: string, active: boolean) {
    await query(sb.from('dishes').update({ active }).eq('id', id))
  },

  async countsByCategory(sb: SupabaseClient, tenantId: string): Promise<Record<string, number>> {
    const data = await query(sb.from('dishes').select('category_id').eq('tenant_id', tenantId))
    const counts: Record<string, number> = {}

    ;(data ?? []).forEach((row) => {
      const cid = (row as Pick<DishRow, 'category_id'>).category_id

      counts[cid] = (counts[cid] ?? 0) + 1
    })

    return counts
  },

  async getBranchPrices(sb: SupabaseClient, dishId: string): Promise<DishBranchPrice[]> {
    const data = await query(
      sb.from('dish_branch_prices').select('*').eq('dish_id', dishId),
    )

    return (data ?? []).map((raw: Record<string, unknown>): DishBranchPrice => {
      const row = raw as DishBranchPriceRow

      return { dishId: row.dish_id, branchId: row.branch_id, price: row.price }
    })
  },

  async setBranchPrices(
    sb: SupabaseClient,
    dishId: string,
    prices: { branchId: string; price: number }[],
  ): Promise<void> {
    // Delete all existing overrides for this dish first
    await query(sb.from('dish_branch_prices').delete().eq('dish_id', dishId))

    if (prices.length === 0) return

    await query(
      sb.from('dish_branch_prices').insert(
        prices.map((p) => ({ dish_id: dishId, branch_id: p.branchId, price: p.price })),
      ),
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
