import type { DishModifierGroup, DishModifierOption, DishTagDefinition, Tenant } from '@fastio/shared'
import { getServerSupabase, mapCategory, mapCombo, mapDish } from '../utils/supabase'

type GroupBindingRow = {
  dish_id: string
  group_id: string
  sort_order: number
  modifier_groups: { id: string; name: string; active: boolean }
}

type OptionBindingRow = {
  dish_id: string
  option_id: string
  price_delta: number
  weight: number | null
  is_default: boolean
  sort_order: number
  modifier_options: { id: string; name: string; group_id: string; sort_order: number; active: boolean }
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
      .is('deleted_at', null)
      .order('sort_order'),
    supabase
      .from('dishes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
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
  const combos = (combosData ?? []).map(mapCombo)
  const comboIds = combos.map((c) => c.id)

  type ClientAddon = { id: string; name: string; weight: number | null; price: number; order: number }
  type AddonBindingRow = {
    dish_id: string
    addon_id: string
    sort_order: number
    addons: { id: string; name: string; weight: number | null; price: number; active: boolean }
  }
  type ComboItemRow = {
    combo_id: string
    sort_order: number
    modifier_option_ids: string[]
    dishes: { name: string; photos: string[]; active: boolean; deleted_at: string | null }
  }

  // Round 2: all secondary queries in parallel — they all depend only on dishIds/comboIds
  const [
    groupBindingsResult,
    optionBindingsResult,
    addonBindingsResult,
    comboItemsResult,
    tagRowsResult,
    dishTagRowsResult,
    comboTagRowsResult,
  ] = await Promise.all([
    dishIds.length > 0
      ? supabase
          .from('dish_modifier_groups')
          .select('dish_id, group_id, sort_order, modifier_groups(id, name, active)')
          .in('dish_id', dishIds)
          .order('sort_order')
      : Promise.resolve({ data: [] }),
    dishIds.length > 0
      ? supabase
          .from('dish_modifier_options')
          .select('dish_id, option_id, price_delta, weight, is_default, sort_order, modifier_options(id, name, group_id, sort_order, active)')
          .in('dish_id', dishIds)
          .eq('active', true)
          .order('sort_order')
      : Promise.resolve({ data: [] }),
    dishIds.length > 0 && addonsEnabled
      ? supabase
          .from('dish_addons')
          .select('dish_id, addon_id, sort_order, addons(id, name, weight, price, active)')
          .in('dish_id', dishIds)
          .order('sort_order')
          .returns<AddonBindingRow[]>()
      : Promise.resolve({ data: [] as AddonBindingRow[] }),
    comboIds.length > 0
      ? supabase
          .from('combo_items')
          .select('combo_id, sort_order, modifier_option_ids, dishes(name, photos, active, deleted_at)')
          .in('combo_id', comboIds)
          .order('sort_order')
          .returns<ComboItemRow[]>()
      : Promise.resolve({ data: [] as ComboItemRow[] }),
    supabase.from('dish_tags').select('*').eq('tenant_id', tenantId).order('sort_order'),
    supabase.from('dish_tag_assignments').select('dish_id, tag_id').eq('tenant_id', tenantId),
    supabase.from('combo_tag_assignments').select('combo_id, tag_id').eq('tenant_id', tenantId),
  ])

  const groupBindings = groupBindingsResult.data
  const optionBindings = optionBindingsResult.data
  const addonBindings = addonBindingsResult.data
  const allItemRows = comboItemsResult.data

  // Filter out combos that have any inactive or deleted dish
  const invalidComboIds = new Set<string>()
  for (const row of (allItemRows ?? []) as unknown as ComboItemRow[]) {
    if (!row.dishes || !row.dishes.active || row.dishes.deleted_at !== null) {
      invalidComboIds.add(row.combo_id)
    }
  }
  let validCombos = combos.filter((c) => !invalidComboIds.has(c.id))
  const validComboIds = new Set(validCombos.map((c) => c.id))
  const itemRows = (allItemRows ?? []).filter((r) => validComboIds.has((r as unknown as ComboItemRow).combo_id))
  const tagRows = tagRowsResult.data
  const dishTagRows = dishTagRowsResult.data
  const comboTagRows = comboTagRowsResult.data

  // Build modifier groups per dish
  const dishModifiers: Record<string, DishModifierGroup[]> = {}

  if (dishIds.length > 0) {
    // Build options map: dishId -> groupId -> options[]
    const optionsMap = new Map<string, Map<string, DishModifierOption[]>>()

    // Supabase infers a complex nested type for relational selects that doesn't match our local types.
    // Safe to cast here: the select() columns exactly match OptionBindingRow fields.
    for (const row of (optionBindings ?? []) as unknown as OptionBindingRow[]) {
      if (!row.modifier_options.active) continue

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
        sortOrder: row.modifier_options.sort_order,
      })
    }

    // Build groups per dish
    // Same reasoning: select() columns match GroupBindingRow exactly.
    for (const row of (groupBindings ?? []) as unknown as GroupBindingRow[]) {
      const dishId = row.dish_id
      const groupId = row.group_id
      const groupName = row.modifier_groups.name

      if (!dishModifiers[dishId]) dishModifiers[dishId] = []

      if (!modifiersEnabled || !row.modifier_groups.active) continue

      let options = (optionsMap.get(dishId)?.get(groupId) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((o) => ({ ...o, groupName }))

      dishModifiers[dishId].push({
        groupId,
        groupName,
        sortOrder: row.sort_order,
        options,
      })
    }
  }

  // Build addons per dish
  const dishAddons: Record<string, ClientAddon[]> = {}

  for (const row of addonBindings ?? []) {
    if (!row.addons.active) continue
    if (!dishAddons[row.dish_id]) dishAddons[row.dish_id] = []
    dishAddons[row.dish_id].push({
      id: row.addons.id,
      name: row.addons.name,
      weight: row.addons.weight,
      price: row.addons.price,
      order: row.sort_order,
    })
  }

  // Build combo items — needs one more round to resolve modifier option names
  const comboItems: Record<string, { name: string; photo: string | null; modifier: string | null }[]> = {}

  if (validComboIds.size > 0 && itemRows && itemRows.length > 0) {
    // Collect all modifier option IDs to resolve names
    const allOptionIds = new Set<string>()
    for (const row of itemRows) {
      for (const id of row.modifier_option_ids ?? []) allOptionIds.add(id)
    }

    // Resolve option names and active status in one query
    const optionNames: Record<string, string> = {}
    const inactiveOptionIds = new Set<string>()
    if (allOptionIds.size > 0) {
      const { data: optData } = await supabase
        .from('modifier_options')
        .select('id, name, active, modifier_groups(active)')
        .in('id', [...allOptionIds])

      for (const o of optData ?? []) {
        optionNames[o.id] = o.name
        const groupActive = (o.modifier_groups as { active: boolean } | null)?.active ?? true
        if (!o.active || !groupActive) inactiveOptionIds.add(o.id)
      }
    }

    // Track combos that have any inactive modifier option
    const combosWithInactiveModifiers = new Set<string>()

    for (const row of itemRows) {
      if (!comboItems[row.combo_id]) comboItems[row.combo_id] = []
      const modNames = (row.modifier_option_ids ?? [])
        .map((id) => {
          if (inactiveOptionIds.has(id)) combosWithInactiveModifiers.add(row.combo_id)
          return optionNames[id]
        })
        .filter(Boolean)
      comboItems[row.combo_id].push({
        name: row.dishes.name,
        photo: row.dishes.photos?.[0] ?? null,
        modifier: modNames.length > 0 ? modNames.join(', ') : null,
      })
    }

    // Remove combos with inactive modifier options from comboItems
    for (const comboId of combosWithInactiveModifiers) {
      delete comboItems[comboId]
    }

    if (combosWithInactiveModifiers.size > 0) {
      validCombos = validCombos.filter((c) => !combosWithInactiveModifiers.has(c.id))
    }
  }

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
  for (const combo of validCombos) {
    combo.tags = comboTagMap[combo.id] ?? []
  }

  // Get tagDisplayMode from tenant layout
  const tenant = event.context.tenant as Tenant | undefined
  const tagDisplayMode = tenant?.siteLayout?.sections?.menu?.tagDisplayMode ?? 'both'

  return {
    categories: (categoriesData ?? []).map(mapCategory),
    dishes,
    combos: validCombos,
    dishModifiers,
    dishAddons,
    comboItems,
    tagDefinitions,
    tagDisplayMode,
    maxAddonsDefault: tenant?.maxAddonsDefault ?? null,
  }
})
