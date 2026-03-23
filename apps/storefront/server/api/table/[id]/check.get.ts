import { getServerSupabase } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const tableId = getRouterParam(event, 'id')
  if (!tableId) throw createError({ statusCode: 400 })

  const supabase = getServerSupabase()

  // Загружаем стол чтобы получить opened_at
  const { data: table } = await supabase
    .from('tables')
    .select('id, opened_at, is_open')
    .eq('id', tableId)
    .eq('tenant_id', tenantId)
    .single()

  if (!table || !table.is_open || !table.opened_at) {
    return { items: [] }
  }

  // Все заказы этого стола после opened_at
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('table_id', tableId)
    .eq('tenant_id', tenantId)
    .eq('delivery_type', 'dine_in')
    .gte('created_at', table.opened_at)

  if (!orders?.length) {
    return { items: [] }
  }

  const orderIds = orders.map(o => o.id as string)

  // Загружаем items и kitchen_queue параллельно
  const [{ data: itemRows }, { data: kitchenRows }] = await Promise.all([
    supabase
      .from('order_items')
      .select('id, order_id, dish_name, price, quantity, modifiers, addons, removed_ingredients, status, sort_order')
      .in('order_id', orderIds)
      .order('sort_order'),
    supabase
      .from('kitchen_queue')
      .select('order_item_id, status')
      .in('order_id', orderIds),
  ])

  // Маппим kitchen status по order_item_id
  // У одного order_item может быть несколько kitchen_queue записей (по quantity)
  // Берём "худший" статус: queued < in_progress < done < served
  const kitchenStatusMap = new Map<string, string>()
  const KITCHEN_PRIORITY: Record<string, number> = { queued: 0, in_progress: 1, done: 2, served: 3 }

  for (const row of (kitchenRows ?? []) as { order_item_id: string; status: string }[]) {
    const current = kitchenStatusMap.get(row.order_item_id)
    if (!current || KITCHEN_PRIORITY[row.status] < KITCHEN_PRIORITY[current]) {
      kitchenStatusMap.set(row.order_item_id, row.status)
    }
  }

  const items = (itemRows ?? []).map(row => ({
    id: row.id as string,
    dishName: row.dish_name as string,
    price: row.price as number,
    quantity: row.quantity as number,
    modifiers: (row.modifiers ?? []) as { groupName: string; optionName: string; priceDelta: number }[],
    addons: (row.addons ?? []) as { addonName: string; price: number }[],
    removedIngredients: (row.removed_ingredients ?? []) as string[],
    status: row.status as 'pending' | 'confirmed',
    kitchenStatus: (kitchenStatusMap.get(row.id as string) ?? null) as string | null,
  }))

  return { items }
})
