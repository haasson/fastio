import { getServerSupabase } from '../utils/supabase'

const VALID_DELIVERY_TYPES = ['delivery', 'pickup'] as const
const VALID_PAYMENT_TYPES = ['cash', 'card', 'online'] as const

// --- In-memory rate limiter по IP ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) return false

  entry.count++
  return true
}

// Периодическая очистка устаревших записей
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip)
  }
}, RATE_LIMIT_WINDOW_MS)

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  // Rate limiting
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!checkRateLimit(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const body = await readBody(event)

  // Валидация базовых полей
  if (!body.customer?.name || !body.customer?.phone) {
    throw createError({ statusCode: 400, message: 'Имя и телефон обязательны' })
  }
  if (!body.items?.length) {
    throw createError({ statusCode: 400, message: 'Корзина пуста' })
  }

  const deliveryType = body.deliveryType
  if (!VALID_DELIVERY_TYPES.includes(deliveryType)) {
    throw createError({ statusCode: 400, message: 'Некорректный тип доставки' })
  }

  const paymentType = body.paymentType ?? 'cash'
  if (!VALID_PAYMENT_TYPES.includes(paymentType)) {
    throw createError({ statusCode: 400, message: 'Некорректный тип оплаты' })
  }

  const supabase = getServerSupabase()

  // Получаем данные тенанта для delivery_fee и delivery_min_order
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('delivery_fee, delivery_min_order')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenantData) {
    throw createError({ statusCode: 500, message: 'Не удалось получить данные ресторана' })
  }

  // Достаём реальные цены блюд из БД
  const dishIds = body.items.map((item: { dishId: string }) => item.dishId)
  const { data: dishes, error: dishesError } = await supabase
    .from('dishes')
    .select('id, price, active, tenant_id')
    .in('id', dishIds)

  if (dishesError) {
    throw createError({ statusCode: 500, message: 'Не удалось получить данные блюд' })
  }

  // Проверяем что все блюда существуют, принадлежат тенанту и активны
  const dishMap = new Map(dishes!.map(d => [d.id as string, d]))

  for (const item of body.items) {
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

  // Загружаем модификаторы для валидации
  const { data: allDishOptions } = await supabase
    .from('dish_modifier_options')
    .select('dish_id, option_id, price_delta, modifier_options(id, name, group_id, modifier_groups(name))')
    .in('dish_id', dishIds)

  // Индексируем: dishId -> optionId -> { priceDelta, groupName, optionName }
  type ValidOption = { priceDelta: number; groupName: string; optionName: string }
  type DishOptionRow = {
    dish_id: string
    option_id: string
    price_delta: number
    modifier_options: { id: string; name: string; group_id: string; modifier_groups: { name: string } }
  }
  const validOptionsMap = new Map<string, Map<string, ValidOption>>()

  for (const row of (allDishOptions ?? []) as unknown as DishOptionRow[]) {
    if (!validOptionsMap.has(row.dish_id)) validOptionsMap.set(row.dish_id, new Map())
    validOptionsMap.get(row.dish_id)!.set(row.option_id, {
      priceDelta: Number(row.price_delta),
      groupName: row.modifier_options.modifier_groups.name,
      optionName: row.modifier_options.name,
    })
  }

  // Пересчитываем subtotal по реальным ценам + валидация модификаторов
  const serverItems = body.items.map((item: { dishId: string; dishName: string; quantity: number; removedIngredients: string[]; modifiers?: { groupName: string; optionName: string; priceDelta: number }[] }) => {
    const dish = dishMap.get(item.dishId)!
    const basePrice = Number(dish.price)

    // Validate and recalculate modifiers from DB
    const serverModifiers: { groupName: string; optionName: string; priceDelta: number }[] = []
    const dishValidOptions = validOptionsMap.get(item.dishId)

    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        // Find matching option by groupName + optionName
        let found = false

        if (dishValidOptions) {
          for (const [, validOpt] of dishValidOptions) {
            if (validOpt.groupName === mod.groupName && validOpt.optionName === mod.optionName) {
              serverModifiers.push({
                groupName: validOpt.groupName,
                optionName: validOpt.optionName,
                priceDelta: validOpt.priceDelta,
              })
              found = true
              break
            }
          }
        }

        if (!found) {
          throw createError({ statusCode: 400, message: `Модификатор "${mod.optionName}" недоступен для "${item.dishName}"` })
        }
      }
    }

    return {
      dishId: item.dishId,
      dishName: item.dishName,
      price: basePrice,
      quantity: item.quantity,
      removedIngredients: item.removedIngredients ?? [],
      ...(serverModifiers.length > 0 ? { modifiers: serverModifiers } : {}),
    }
  })

  const subtotal = serverItems.reduce(
    (sum: number, item: { price: number; quantity: number; modifiers?: { priceDelta: number }[] }) =>
      sum + (item.price + (item.modifiers?.reduce((s: number, m: { priceDelta: number }) => s + m.priceDelta, 0) ?? 0)) * item.quantity,
    0,
  )

  // Delivery fee из тенанта
  const deliveryFee = deliveryType === 'delivery' ? Number(tenantData.delivery_fee) : 0

  // Проверяем минимальный заказ для доставки
  if (deliveryType === 'delivery' && subtotal < Number(tenantData.delivery_min_order)) {
    throw createError({
      statusCode: 400,
      message: `Минимальная сумма заказа для доставки: ${tenantData.delivery_min_order} ₽`,
    })
  }

  // discountAmount — пока доверяем клиенту (TODO: серверная валидация промокодов)
  const discountAmount = Math.max(0, Number(body.discountAmount) || 0)
  const total = subtotal - discountAmount + deliveryFee

  const { data, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      customer: body.customer,
      items: serverItems,
      delivery_type: deliveryType,
      address: body.address ?? null,
      comment: body.comment ?? null,
      promo_code: body.promoCode ?? null,
      discount_amount: discountAmount,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      status: 'new',
      payment_type: paymentType,
    })
    .select('id')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { id: data.id }
})
