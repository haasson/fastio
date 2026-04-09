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
    longDescription: row.long_description ?? null,
    price: row.price,
    photos: row.photos,
    ingredients: row.ingredients,
    nutrition: row.nutrition,
    weightUnit: row.weight_unit ?? 'г',
    tags: [],
    active: row.active,
    order: row.sort_order,
    requiresKitchen: row.requires_kitchen,
    maxAddons: row.max_addons ?? null,
  }
}

export const dishesApi = {
  async listAllActive(sb: SupabaseClient, tenantId: string): Promise<Dish[]> {
    const data = await query(
      sb.from('dishes').select('*').eq('tenant_id', tenantId).is('deleted_at', null).eq('active', true).order('name'),
    )

    return (data ?? []).map(mapDish)
  },

  async listAllIncludingInactive(sb: SupabaseClient, tenantId: string): Promise<Dish[]> {
    const data = await query(
      sb.from('dishes').select('*').eq('tenant_id', tenantId).is('deleted_at', null).order('name'),
    )

    return (data ?? []).map(mapDish)
  },

  async list(sb: SupabaseClient, tenantId: string, categoryId: string) {
    const data = await query(sb.from('dishes').select('*').eq('tenant_id', tenantId).eq('category_id', categoryId).is('deleted_at', null).order('sort_order'))

    return (data ?? []).map(mapDish)
  },

  async add(sb: SupabaseClient, tenantId: string, data: DishFormData): Promise<Dish | null> {
    const result = await query(sb.from('dishes').insert({
      tenant_id: tenantId,
      category_id: data.categoryId,
      name: data.name,
      description: data.description,
      long_description: data.longDescription ?? null,
      price: data.price,
      photos: data.photos ?? [],
      ingredients: data.ingredients,
      nutrition: data.nutrition,
      weight_unit: data.weightUnit,
      active: data.active,
      sort_order: data.order,
      requires_kitchen: data.requiresKitchen,
      max_addons: data.maxAddons,
    }).select().single())

    return result ? mapDish(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<DishFormData>): Promise<Dish | null> {
    const result = await query(sb.from('dishes').update(
      filterDefined({
        name: data.name,
        description: data.description,
        long_description: data.longDescription,
        price: data.price,
        category_id: data.categoryId,
        ingredients: data.ingredients,
        nutrition: data.nutrition,
        weight_unit: data.weightUnit,
        active: data.active,
        sort_order: data.order,
        photos: data.photos,
        requires_kitchen: data.requiresKitchen,
        max_addons: data.maxAddons,
      }),
    ).eq('id', id).select().single())

    return result ? mapDish(result) : null
  },

  async remove(sb: SupabaseClient, id: string) {
    await query(sb.from('dishes').update({ deleted_at: new Date().toISOString() }).eq('id', id))
  },

  async reorder(sb: SupabaseClient, items: { id: string; order: number }[]) {
    await query(sb.rpc('reorder_dishes', { items }))
  },

  async toggleActive(sb: SupabaseClient, id: string, active: boolean) {
    await query(sb.from('dishes').update({ active }).eq('id', id))
  },

  async countsByCategory(sb: SupabaseClient, tenantId: string): Promise<Record<string, number>> {
    const data = await query(sb.from('dishes').select('category_id').eq('tenant_id', tenantId).is('deleted_at', null))
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

      return { dishId: row.dish_id, branchId: row.branch_id, price: row.price, active: row.active }
    })
  },

  async setBranchPrices(
    sb: SupabaseClient,
    dishId: string,
    prices: { branchId: string; price: number | null; active: boolean | null }[],
  ): Promise<void> {
    await query(sb.from('dish_branch_prices').delete().eq('dish_id', dishId))

    const rows = prices.filter((p) => p.price != null || p.active === false)

    if (rows.length === 0) return

    await query(
      sb.from('dish_branch_prices').insert(
        rows.map((p) => ({ dish_id: dishId, branch_id: p.branchId, price: p.price, active: p.active })),
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
        .select('group_id, sort_order, modifier_groups(id, name, active)')
        .eq('dish_id', dishId)
        .order('sort_order'),
    ) as unknown as { group_id: string; sort_order: number; modifier_groups: { id: string; name: string; active: boolean } }[]

    if (!groupRows || groupRows.length === 0) return []

    const groupActiveMap = new Map(groupRows.map((g) => [g.group_id, g.modifier_groups.active]))

    const optionRows = await query(
      sb.from('dish_modifier_options')
        .select('option_id, price_delta, weight, is_default, sort_order, active, modifier_options(id, name, group_id)')
        .eq('dish_id', dishId)
        .order('sort_order'),
    ) as unknown as { option_id: string; price_delta: number; weight: number | null; is_default: boolean; sort_order: number; active: boolean; modifier_options: { id: string; name: string; group_id: string } }[]

    const optionsByGroup = new Map<string, DishModifierOption[]>()

    for (const row of optionRows ?? []) {
      const groupId = row.modifier_options.group_id
      const arr = optionsByGroup.get(groupId) ?? []
      const groupActive = groupActiveMap.get(groupId) ?? true

      arr.push({
        optionId: row.option_id,
        optionName: row.modifier_options.name,
        groupId,
        groupName: '',
        priceDelta: Number(row.price_delta),
        weight: row.weight,
        isDefault: row.is_default,
        sortOrder: row.sort_order,
        active: row.active && groupActive,
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

    // Insert option bindings (including inactive — to preserve prices across sessions)
    const allOptions = modifierGroups.flatMap((g) => g.options.map((o, i) => ({
      dish_id: dishId,
      option_id: o.optionId,
      price_delta: o.priceDelta,
      weight: o.weight ?? null,
      is_default: o.isDefault,
      sort_order: i,
      active: o.active,
    })))

    if (allOptions.length > 0) {
      await query(sb.from('dish_modifier_options').insert(allOptions))
    }
  },
}
