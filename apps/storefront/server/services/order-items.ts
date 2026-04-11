import type { SupabaseClient } from '@supabase/supabase-js'
import { calcSubtotal } from './order-calc'

type ClientItem = {
  dishId: string | null
  comboId?: string
  dishName: string
  categoryName?: string
  quantity: number
  removedIngredients: string[]
  modifiers?: { optionId?: string; groupName: string; optionName: string; priceDelta: number }[]
  addons?: { addonId: string; addonName: string; price: number }[]
}

export type ServerItem = {
  dishId: string | null
  comboId?: string
  dishName: string
  categoryName: string | null
  price: number
  quantity: number
  removedIngredients: string[]
  modifiers?: { groupName: string; optionName: string; priceDelta: number }[]
  addons?: { addonId: string; addonName: string; price: number }[]
}

type ValidOption = {
  priceDelta: number
  groupName: string
  optionName: string
}

type DishOptionRow = {
  dish_id: string
  option_id: string
  price_delta: number
  modifier_options: {
    id: string
    name: string
    group_id: string
    modifier_groups: { name: string }
  }
}

type DishAddonRow = {
  dish_id: string
  addon_id: string
  addons: { id: string; name: string; price: number; active: boolean }
}

export type ComboItemsMap = Map<string, { dishName: string; dishId: string | null; categoryName: string | null }[]>

export async function validateAndBuildItems(
  supabase: SupabaseClient,
  tenantId: string,
  items: ClientItem[],
): Promise<{ serverItems: ServerItem[]; subtotal: number; comboItemsMap: ComboItemsMap }> {
  const dishIds = items.map(item => item.dishId).filter(Boolean) as string[]

  const [{ data: dishes, error: dishesError }, { data: allDishOptions }, { data: allDishAddons }] = await Promise.all([
    supabase.from('dishes').select('id, price, active, tenant_id').in('id', dishIds),
    supabase
      .from('dish_modifier_options')
      .select('dish_id, option_id, price_delta, modifier_options(id, name, group_id, modifier_groups(name))')
      .in('dish_id', dishIds),
    supabase
      .from('dish_addons')
      .select('dish_id, addon_id, addons(id, name, price, active)')
      .in('dish_id', dishIds),
  ])

  if (dishesError) {
    throw createError({ statusCode: 500, message: 'Не удалось получить данные блюд' })
  }

  const dishMap = new Map((dishes ?? []).map(d => [d.id as string, d]))

  // Fetch combo data
  const comboIds = items.filter(item => item.comboId).map(item => item.comboId!)
  const comboItemsMap: ComboItemsMap = new Map()
  const comboPriceMap = new Map<string, number>()

  if (comboIds.length > 0) {
    const [{ data: comboItemRows }, { data: comboRows }] = await Promise.all([
      supabase.from('combo_items').select('combo_id, dish_id, dishes(name, categories(name))').in('combo_id', comboIds).order('sort_order'),
      supabase.from('combos').select('id, price').in('id', comboIds),
    ])

    if (comboItemRows) {
      for (const row of comboItemRows as unknown as { combo_id: string; dish_id: string; dishes: { name: string; categories: { name: string } | null } | null }[]) {
        if (!row.dishes) continue
        if (!comboItemsMap.has(row.combo_id)) comboItemsMap.set(row.combo_id, [])
        comboItemsMap.get(row.combo_id)!.push({
          dishName: row.dishes.name,
          dishId: row.dish_id,
          categoryName: row.dishes.categories?.name ?? null,
        })
      }
    }
    if (comboRows) {
      for (const row of comboRows as { id: string; price: number }[]) {
        comboPriceMap.set(row.id, Number(row.price))
      }
    }
  }

  // Validate each item
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw createError({ statusCode: 400, message: `Некорректное количество для "${item.dishName}"` })
    }
    if (!item.dishId) continue
    const dish = dishMap.get(item.dishId)
    if (!dish) {
      throw createError({ statusCode: 400, message: `Блюдо ${item.dishId} не найдено` })
    }
    if (dish.tenant_id !== tenantId) {
      throw createError({ statusCode: 400, message: `Блюдо ${item.dishId} не принадлежит этому ресторану` })
    }
    if (!dish.active) {
      throw createError({ statusCode: 400, message: `Блюдо "${item.dishName}" временно недоступно` })
    }
  }

  // Build valid options index: dishId -> optionId -> { priceDelta, groupName, optionName }
  const validOptionsMap = new Map<string, Map<string, ValidOption>>()
  for (const row of (allDishOptions ?? []) as unknown as DishOptionRow[]) {
    if (!validOptionsMap.has(row.dish_id)) validOptionsMap.set(row.dish_id, new Map())
    validOptionsMap.get(row.dish_id)!.set(row.option_id, {
      priceDelta: Number(row.price_delta),
      groupName: row.modifier_options.modifier_groups.name,
      optionName: row.modifier_options.name,
    })
  }

  // Build valid addons index: dishId -> addonId -> { name, price }
  type ValidAddon = { addonId: string; name: string; price: number }
  const validAddonsMap = new Map<string, Map<string, ValidAddon>>()
  for (const row of (allDishAddons ?? []) as unknown as DishAddonRow[]) {
    if (!row.addons?.active) continue
    if (!validAddonsMap.has(row.dish_id)) validAddonsMap.set(row.dish_id, new Map())
    validAddonsMap.get(row.dish_id)!.set(row.addon_id, {
      addonId: row.addons.id,
      name: row.addons.name,
      price: Number(row.addons.price),
    })
  }

  // Build server items with validated prices and modifiers
  const serverItems: ServerItem[] = items.map((item) => {
    const isCombo = !item.dishId && !!item.comboId
    const basePrice = isCombo
      ? (comboPriceMap.get(item.comboId!) ?? 0)
      : Number(dishMap.get(item.dishId!)!.price)

    const serverModifiers: { groupName: string; optionName: string; priceDelta: number }[] = []
    const dishValidOptions = item.dishId ? validOptionsMap.get(item.dishId) : undefined

    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        let validOpt: ValidOption | undefined

        if (dishValidOptions) {
          if (mod.optionId) {
            validOpt = dishValidOptions.get(mod.optionId)
          }
          if (!validOpt) {
            for (const [, opt] of dishValidOptions) {
              if (opt.groupName === mod.groupName && opt.optionName === mod.optionName) {
                validOpt = opt
                break
              }
            }
          }
        }

        if (!validOpt) {
          throw createError({ statusCode: 400, message: `Модификатор "${mod.optionName}" недоступен для "${item.dishName}"` })
        }

        serverModifiers.push({
          groupName: validOpt.groupName,
          optionName: validOpt.optionName,
          priceDelta: validOpt.priceDelta,
        })
      }
    }

    const serverAddons: { addonId: string; addonName: string; price: number }[] = []
    const dishValidAddons = item.dishId ? validAddonsMap.get(item.dishId) : undefined

    if (item.addons && item.addons.length > 0) {
      for (const addon of item.addons) {
        const validAddon = dishValidAddons?.get(addon.addonId)
        if (!validAddon) {
          throw createError({ statusCode: 400, message: `Добавка "${addon.addonName}" недоступна для "${item.dishName}"` })
        }
        serverAddons.push({
          addonId: validAddon.addonId,
          addonName: validAddon.name,
          price: validAddon.price,
        })
      }
    }

    return {
      dishId: item.dishId,
      comboId: item.comboId,
      dishName: item.dishName,
      categoryName: item.categoryName ?? null,
      price: basePrice,
      quantity: item.quantity,
      removedIngredients: item.removedIngredients ?? [],
      ...(serverModifiers.length > 0 ? { modifiers: serverModifiers } : {}),
      ...(serverAddons.length > 0 ? { addons: serverAddons } : {}),
    }
  })

  const subtotal = calcSubtotal(serverItems)

  return { serverItems, subtotal, comboItemsMap }
}
