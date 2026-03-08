import type { DishModifierGroup, DishModifierOption } from '@fastio/shared'
import { getServerSupabase, mapCategory, mapDish } from '../utils/supabase'

type GroupBindingRow = {
  dish_id: string
  group_id: string
  sort_order: number
  modifier_groups: { id: string; name: string }
}

type OptionBindingRow = {
  dish_id: string
  option_id: string
  price_delta: number
  is_default: boolean
  sort_order: number
  modifier_options: { id: string; name: string; group_id: string }
}

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const supabase = getServerSupabase()

  const [{ data: categoriesData }, { data: dishesData }] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('dishes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('sort_order'),
  ])

  const dishes = (dishesData ?? []).map(mapDish)
  const dishIds = dishes.map((d) => d.id)

  // Load modifier bindings for all dishes in batch
  const dishModifiers: Record<string, DishModifierGroup[]> = {}

  if (dishIds.length > 0) {
    const [{ data: groupBindings }, { data: optionBindings }] = await Promise.all([
      supabase
        .from('dish_modifier_groups')
        .select('dish_id, group_id, sort_order, modifier_groups(id, name)')
        .in('dish_id', dishIds)
        .order('sort_order'),
      supabase
        .from('dish_modifier_options')
        .select('dish_id, option_id, price_delta, is_default, sort_order, modifier_options(id, name, group_id)')
        .in('dish_id', dishIds)
        .order('sort_order'),
    ])

    // Build options map: dishId -> groupId -> options[]
    const optionsMap = new Map<string, Map<string, DishModifierOption[]>>()

    for (const row of (optionBindings ?? []) as unknown as OptionBindingRow[]) {
      const dishId = row.dish_id
      const groupId = row.modifier_options.group_id

      if (!optionsMap.has(dishId)) optionsMap.set(dishId, new Map())
      const dishMap = optionsMap.get(dishId)!

      if (!dishMap.has(groupId)) dishMap.set(groupId, [])
      dishMap.get(groupId)!.push({
        optionId: row.option_id,
        optionName: row.modifier_options.name,
        groupId,
        groupName: '',
        priceDelta: Number(row.price_delta),
        isDefault: row.is_default,
        sortOrder: row.sort_order,
      })
    }

    // Build groups per dish
    for (const row of (groupBindings ?? []) as unknown as GroupBindingRow[]) {
      const dishId = row.dish_id
      const groupId = row.group_id
      const groupName = row.modifier_groups.name

      if (!dishModifiers[dishId]) dishModifiers[dishId] = []

      const options = (optionsMap.get(dishId)?.get(groupId) ?? []).map((o) => ({
        ...o,
        groupName,
      }))

      dishModifiers[dishId].push({
        groupId,
        groupName,
        sortOrder: row.sort_order,
        options,
      })
    }
  }

  return {
    categories: (categoriesData ?? []).map(mapCategory),
    dishes,
    dishModifiers,
  }
})
