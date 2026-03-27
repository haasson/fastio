import type { DishModifierGroup, DishModifierOption, DishTagDefinition, Tenant } from '@fastio/shared'
import { getServerSupabase, mapCategory, mapCombo, mapDish } from '../utils/supabase'

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
  weight: number | null
  is_default: boolean
  sort_order: number
  modifier_options: { id: string; name: string; group_id: string }
}

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const tenantModules = (event.context.tenant as Tenant | undefined)?.modules
  const modifiersEnabled = tenantModules?.modifiers ?? true
  const addonsEnabled = tenantModules?.addons ?? true
  const combosEnabled = tenantModules?.combos ?? true

  const supabase = getServerSupabase()

  const [{ data: categoriesData }, { data: dishesData }, { data: combosData }] = await Promise.all([
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
    combosEnabled
      ? supabase
          .from('combos')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .order('sort_order')
      : Promise.resolve({ data: [] }),
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
        .select('dish_id, option_id, price_delta, weight, is_default, sort_order, modifier_options(id, name, group_id)')
        .in('dish_id', dishIds)
        .order('sort_order'),
    ])

    // Build options map: dishId -> groupId -> options[]
    const optionsMap = new Map<string, Map<string, DishModifierOption[]>>()

    // Supabase infers a complex nested type for relational selects that doesn't match our local types.
    // Safe to cast here: the select() columns exactly match OptionBindingRow fields.
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
        weight: row.weight,
        isDefault: row.is_default,
        sortOrder: row.sort_order,
      })
    }

    // Build groups per dish
    // Same reasoning: select() columns match GroupBindingRow exactly.
    for (const row of (groupBindings ?? []) as unknown as GroupBindingRow[]) {
      const dishId = row.dish_id
      const groupId = row.group_id
      const groupName = row.modifier_groups.name

      if (!dishModifiers[dishId]) dishModifiers[dishId] = []

      let options = (optionsMap.get(dishId)?.get(groupId) ?? []).map((o) => ({
        ...o,
        groupName,
      }))

      // Если модуль отключён — оставляем только дефолтную опцию (для отображения и расчёта цены)
      if (!modifiersEnabled) {
        const defaultOpt = options.find((o) => o.isDefault)
        if (!defaultOpt) continue
        options = [defaultOpt]
      }

      dishModifiers[dishId].push({
        groupId,
        groupName,
        sortOrder: row.sort_order,
        options,
      })
    }
  }

  // Load addon bindings for all dishes in batch
  type ClientAddon = { id: string; name: string; weight: number | null; price: number; order: number }
  const dishAddons: Record<string, ClientAddon[]> = {}

  if (dishIds.length > 0 && addonsEnabled) {
    type AddonBindingRow = {
      dish_id: string
      addon_id: string
      sort_order: number
      addons: { id: string; name: string; weight: number | null; price: number }
    }

    const { data: addonBindings } = await supabase
      .from('dish_addons')
      .select('dish_id, addon_id, sort_order, addons(id, name, weight, price)')
      .in('dish_id', dishIds)
      .order('sort_order')
      .returns<AddonBindingRow[]>()

    for (const row of addonBindings ?? []) {
      if (!dishAddons[row.dish_id]) dishAddons[row.dish_id] = []
      dishAddons[row.dish_id].push({
        id: row.addons.id,
        name: row.addons.name,
        weight: row.addons.weight,
        price: row.addons.price,
        order: row.sort_order,
      })
    }
  }

  // Load combo items (composition) in batch
  const combos = (combosData ?? []).map(mapCombo)
  const comboIds = combos.map((c) => c.id)
  const comboItems: Record<string, { name: string; photo: string | null; modifier: string | null }[]> = {}

  if (comboIds.length > 0) {
    type ComboItemRow = {
      combo_id: string
      sort_order: number
      modifier_option_ids: string[]
      dishes: { name: string; photos: string[] }
    }

    const { data: itemRows } = await supabase
      .from('combo_items')
      .select('combo_id, sort_order, modifier_option_ids, dishes(name, photos)')
      .in('combo_id', comboIds)
      .order('sort_order')
      .returns<ComboItemRow[]>()

    // Collect all modifier option IDs to resolve names
    const allOptionIds = new Set<string>()
    for (const row of itemRows ?? []) {
      for (const id of row.modifier_option_ids ?? []) allOptionIds.add(id)
    }

    // Resolve option names in one query
    const optionNames: Record<string, string> = {}
    if (allOptionIds.size > 0) {
      const { data: optData } = await supabase
        .from('modifier_options')
        .select('id, name')
        .in('id', [...allOptionIds])

      for (const o of optData ?? []) {
        optionNames[o.id] = o.name
      }
    }

    for (const row of itemRows ?? []) {
      if (!comboItems[row.combo_id]) comboItems[row.combo_id] = []
      const modNames = (row.modifier_option_ids ?? [])
        .map((id) => optionNames[id])
        .filter(Boolean)
      comboItems[row.combo_id].push({
        name: row.dishes.name,
        photo: row.dishes.photos?.[0] ?? null,
        modifier: modNames.length > 0 ? modNames.join(', ') : null,
      })
    }
  }

  // Load tag definitions and assignments
  const [{ data: tagRows }, { data: dishTagRows }, { data: comboTagRows }] = await Promise.all([
    supabase.from('dish_tags').select('*').eq('tenant_id', tenantId).order('sort_order'),
    supabase.from('dish_tag_assignments').select('dish_id, tag_id').eq('tenant_id', tenantId),
    supabase.from('combo_tag_assignments').select('combo_id, tag_id').eq('tenant_id', tenantId),
  ])

  const tagDefinitions: DishTagDefinition[] = (tagRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    tenantId: r.tenant_id as string,
    name: r.name as string,
    icon: r.icon as string,
    color: r.color as string,
    sortOrder: r.sort_order as number,
  }))

  // Attach tag IDs to dishes and combos
  const dishTagMap: Record<string, string[]> = {}
  for (const row of dishTagRows ?? []) {
    const dishId = (row as Record<string, unknown>).dish_id as string
    const tagId = (row as Record<string, unknown>).tag_id as string
    ;(dishTagMap[dishId] ??= []).push(tagId)
  }
  for (const dish of dishes) {
    dish.tags = dishTagMap[dish.id] ?? []
  }

  const comboTagMap: Record<string, string[]> = {}
  for (const row of comboTagRows ?? []) {
    const comboId = (row as Record<string, unknown>).combo_id as string
    const tagId = (row as Record<string, unknown>).tag_id as string
    ;(comboTagMap[comboId] ??= []).push(tagId)
  }
  for (const combo of combos) {
    combo.tags = comboTagMap[combo.id] ?? []
  }

  // Get tagDisplayMode from tenant layout
  const tenant = event.context.tenant as Tenant | undefined
  const tagDisplayMode = tenant?.siteLayout?.sections?.menu?.tagDisplayMode ?? 'both'

  return {
    categories: (categoriesData ?? []).map(mapCategory),
    dishes,
    combos,
    dishModifiers,
    dishAddons,
    comboItems,
    tagDefinitions,
    tagDisplayMode,
    maxAddonsDefault: tenant?.maxAddonsDefault ?? null,
  }
})
