import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dish, DishBranchPrice, DishModifierGroup, DishModifierOption } from '@fastio/shared'
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

  async listByTag(sb: SupabaseClient, tenantId: string, tag: string): Promise<Dish[]> {
    const [dishes, tagOrders] = await Promise.all([
      query(sb.from('dishes').select('*').eq('tenant_id', tenantId).contains('tags', [tag])),
      query(sb.from('dish_tag_orders').select('dish_id, sort_order').eq('tenant_id', tenantId).eq('tag', tag)),
    ])

    const orderMap = new Map<string, number>(
      (tagOrders ?? []).map((r: Record<string, unknown>) => [r.dish_id as string, r.sort_order as number]),
    )

    return (dishes ?? [])
      .map(mapDish)
      .sort((a, b) => {
        const oa = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity
        const ob = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity

        return oa !== ob ? oa - ob : a.name.localeCompare(b.name)
      })
  },

  async reorderByTag(sb: SupabaseClient, tenantId: string, tag: string, items: { id: string; order: number }[]): Promise<void> {
    await query(
      sb.from('dish_tag_orders').upsert(
        items.map(({ id, order }) => ({ tenant_id: tenantId, tag, dish_id: id, sort_order: order })),
        { onConflict: 'tenant_id,tag,dish_id' },
      ),
    )
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

  async countsByTag(sb: SupabaseClient, tenantId: string): Promise<Record<string, number>> {
    const data = await query(sb.from('dishes').select('tags').eq('tenant_id', tenantId).eq('active', true))
    const counts: Record<string, number> = {}

    ;(data ?? []).forEach((row: Record<string, unknown>) => {
      ((row.tags as string[]) ?? []).forEach((tag) => {
        counts[tag] = (counts[tag] ?? 0) + 1
      })
    })

    return counts
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

  async getDishModifiers(sb: SupabaseClient, dishId: string): Promise<DishModifierGroup[]> {
    const groupRows = await query(
      sb.from('dish_modifier_groups')
        .select('group_id, sort_order, modifier_groups(id, name)')
        .eq('dish_id', dishId)
        .order('sort_order'),
    ) as unknown as { group_id: string; sort_order: number; modifier_groups: { id: string; name: string } }[]

    if (!groupRows || groupRows.length === 0) return []

    const optionRows = await query(
      sb.from('dish_modifier_options')
        .select('option_id, price_delta, is_default, sort_order, modifier_options(id, name, group_id)')
        .eq('dish_id', dishId)
        .order('sort_order'),
    ) as unknown as { option_id: string; price_delta: number; is_default: boolean; sort_order: number; modifier_options: { id: string; name: string; group_id: string } }[]

    const optionsByGroup = new Map<string, DishModifierOption[]>()

    for (const row of optionRows ?? []) {
      const groupId = row.modifier_options.group_id
      const arr = optionsByGroup.get(groupId) ?? []

      arr.push({
        optionId: row.option_id,
        optionName: row.modifier_options.name,
        groupId,
        groupName: '',
        priceDelta: Number(row.price_delta),
        isDefault: row.is_default,
        sortOrder: row.sort_order,
      })
      optionsByGroup.set(groupId, arr)
    }

    return groupRows.map((g) => {
      const options = (optionsByGroup.get(g.group_id) ?? []).map((o) => ({
        ...o,
        groupName: g.modifier_groups.name,
      }))

      return {
        groupId: g.group_id,
        groupName: g.modifier_groups.name,
        sortOrder: g.sort_order,
        options,
      }
    })
  },

  async getDishIdsWithModifiers(sb: SupabaseClient, dishIds: string[]): Promise<Set<string>> {
    const data = await query(
      sb.from('dish_modifier_groups').select('dish_id').in('dish_id', dishIds),
    )

    return new Set((data ?? []).map((row: Record<string, unknown>) => row.dish_id as string))
  },

  async setDishModifiers(
    sb: SupabaseClient,
    dishId: string,
    modifierGroups: DishModifierGroup[],
  ): Promise<void> {
    // Clear existing bindings
    await query(sb.from('dish_modifier_options').delete().eq('dish_id', dishId))
    await query(sb.from('dish_modifier_groups').delete().eq('dish_id', dishId))

    if (modifierGroups.length === 0) return

    // Insert group bindings
    await query(
      sb.from('dish_modifier_groups').insert(
        modifierGroups.map((g, i) => ({
          dish_id: dishId,
          group_id: g.groupId,
          sort_order: i,
        })),
      ),
    )

    // Insert option bindings
    const allOptions = modifierGroups.flatMap((g) => g.options.map((o, i) => ({
      dish_id: dishId,
      option_id: o.optionId,
      price_delta: o.priceDelta,
      is_default: o.isDefault,
      sort_order: i,
    })))

    if (allOptions.length > 0) {
      await query(sb.from('dish_modifier_options').insert(allOptions))
    }
  },
}
