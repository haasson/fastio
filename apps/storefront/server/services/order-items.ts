import type { SupabaseClient } from '@supabase/supabase-js'

type ClientItem = {
  dishId: string | null
  comboId?: string
  dishName: string
  categoryName?: string
  quantity: number
  removedIngredients: string[]
  modifiers?: { optionId?: string; groupName: string; optionName: string; priceDelta: number }[]
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

export type ComboItemsMap = Map<string, { dishName: string }[]>

export async function validateAndBuildItems(
  supabase: SupabaseClient,
  tenantId: string,
  items: ClientItem[],
): Promise<{ serverItems: ServerItem[]; subtotal: number; comboItemsMap: ComboItemsMap }> {
  const dishIds = items.map(item => item.dishId).filter(Boolean) as string[]

  const [{ data: dishes, error: dishesError }, { data: allDishOptions }] = await Promise.all([
    supabase.from('dishes').select('id, price, active, tenant_id').in('id', dishIds),
    supabase
      .from('dish_modifier_options')
      .select('dish_id, option_id, price_delta, modifier_options(id, name, group_id, modifier_groups(name))')
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
      supabase.from('combo_items').select('combo_id, dishes(name)').in('combo_id', comboIds).order('sort_order'),
      supabase.from('combos').select('id, price').in('id', comboIds),
    ])

    if (comboItemRows) {
      for (const row of comboItemRows as unknown as { combo_id: string; dishes: { name: string } | null }[]) {
        if (!row.dishes) continue
        if (!comboItemsMap.has(row.combo_id)) comboItemsMap.set(row.combo_id, [])
        comboItemsMap.get(row.combo_id)!.push({ dishName: row.dishes.name })
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

    return {
      dishId: item.dishId,
      comboId: item.comboId,
      dishName: item.dishName,
      categoryName: item.categoryName ?? null,
      price: basePrice,
      quantity: item.quantity,
      removedIngredients: item.removedIngredients ?? [],
      ...(serverModifiers.length > 0 ? { modifiers: serverModifiers } : {}),
    }
  })

  const subtotal = serverItems.reduce(
    (sum, item) =>
      sum + (item.price + (item.modifiers?.reduce((s, m) => s + m.priceDelta, 0) ?? 0)) * item.quantity,
    0,
  )

  return { serverItems, subtotal, comboItemsMap }
}
