import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dish } from '@fastio/shared'

export type DishFormData = Omit<Dish, 'id' | 'tenantId' | 'photos'>

function mapDish(row: Record<string, unknown>): Dish {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    categoryId: row.category_id as string,
    name: row.name as string,
    description: row.description as string,
    price: row.price as number,
    photos: row.photos as string[],
    ingredients: row.ingredients as Dish['ingredients'],
    nutrition: row.nutrition as Dish['nutrition'],
    tags: row.tags as Dish['tags'],
    active: row.active as boolean,
    order: row.sort_order as number,
  }
}

export const dishesApi = {
  async list(sb: SupabaseClient, tenantId: string, categoryId: string) {
    const data = await query(sb.from('dishes').select('*').eq('tenant_id', tenantId).eq('category_id', categoryId).order('sort_order'))
    return (data ?? []).map(mapDish)
  },

  async add(sb: SupabaseClient, tenantId: string, data: DishFormData) {
    await query(sb.from('dishes').insert({
      tenant_id: tenantId,
      category_id: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price,
      photos: [],
      ingredients: data.ingredients,
      nutrition: data.nutrition,
      tags: data.tags,
      active: data.active,
      sort_order: data.order,
    }))
  },

  async update(sb: SupabaseClient, id: string, data: Partial<DishFormData>) {
    await query(sb.from('dishes').update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.categoryId !== undefined && { category_id: data.categoryId }),
      ...(data.ingredients !== undefined && { ingredients: data.ingredients }),
      ...(data.nutrition !== undefined && { nutrition: data.nutrition }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.active !== undefined && { active: data.active }),
      ...(data.order !== undefined && { sort_order: data.order }),
    }).eq('id', id))
  },

  async remove(sb: SupabaseClient, id: string) {
    await query(sb.from('dishes').delete().eq('id', id))
  },

  async toggleActive(sb: SupabaseClient, id: string, active: boolean) {
    await query(sb.from('dishes').update({ active }).eq('id', id))
  },

  async countsByCategory(sb: SupabaseClient, tenantId: string): Promise<Record<string, number>> {
    const data = await query(sb.from('dishes').select('category_id').eq('tenant_id', tenantId))
    const counts: Record<string, number> = {}
    ;(data ?? []).forEach((row) => {
      const cid = row.category_id as string
      counts[cid] = (counts[cid] ?? 0) + 1
    })
    return counts
  },
}
