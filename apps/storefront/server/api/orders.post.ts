import { findDeliveryZone } from '@fastio/shared'
import type { DeliveryZone } from '@fastio/shared'
import { getServerSupabase, mapDeliveryZoneRow } from '../utils/supabase'

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
    .select('delivery_fee, delivery_min_order, delivery_enabled')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenantData) {
    throw createError({ statusCode: 500, message: 'Не удалось получить данные ресторана' })
  }

  if (deliveryType === 'delivery' && !tenantData.delivery_enabled) {
    throw createError({ statusCode: 400, message: 'Доставка отключена' })
  }

  // Загружаем филиалы и зоны доставки тенанта
  const [{ data: branchRows }, { data: zoneRows }] = await Promise.all([
    supabase.from('branches').select('id').eq('tenant_id', tenantId).eq('is_active', true).limit(2),
    supabase.from('delivery_zones').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order'),
  ])

  const hasZones = zoneRows && zoneRows.length > 0
  let matchedZone: DeliveryZone | null = null
  let orderBranchId: string | null = null

  if (hasZones && deliveryType === 'delivery') {
    const geoLat = Number(body.geoLat)
    const geoLon = Number(body.geoLon)

    if (Number.isNaN(geoLat) || Number.isNaN(geoLon)) {
      throw createError({ statusCode: 400, message: 'Для доставки необходимо указать координаты адреса' })
    }

    const zones: DeliveryZone[] = zoneRows.map(mapDeliveryZoneRow)

    matchedZone = findDeliveryZone([geoLon, geoLat], zones)

    if (!matchedZone) {
      throw createError({ statusCode: 400, message: 'Адрес находится вне зоны доставки' })
    }

    orderBranchId = matchedZone.branchId
  }

  // Если зон нет или это самовывоз — привязываем к единственному филиалу
  if (!orderBranchId && branchRows?.length === 1) {
    orderBranchId = branchRows[0].id as string
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
  const dishMap = new Map((dishes ?? []).map(d => [d.id as string, d]))

  for (const item of body.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw createError({ statusCode: 400, message: `Некорректное количество для "${item.dishName}"` })
    }
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
  const serverItems = body.items.map((item: { dishId: string; dishName: string; categoryName?: string; quantity: number; removedIngredients: string[]; modifiers?: { optionId?: string; groupName: string; optionName: string; priceDelta: number }[] }) => {
    const dish = dishMap.get(item.dishId)!
    const basePrice = Number(dish.price)

    // Validate and recalculate modifiers from DB
    const serverModifiers: { groupName: string; optionName: string; priceDelta: number }[] = []
    const dishValidOptions = validOptionsMap.get(item.dishId)

    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        let validOpt: ValidOption | undefined

        if (dishValidOptions) {
          // Сначала матчим по optionId (надёжно), fallback — по именам (для старых клиентов)
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
      dishName: item.dishName,
      categoryName: item.categoryName ?? null,
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

  // Delivery fee и min order: из зоны (если есть) или из тенанта (fallback)
  const deliveryFee = deliveryType === 'delivery'
    ? (matchedZone ? matchedZone.deliveryFee : Number(tenantData.delivery_fee))
    : 0

  const minOrder = matchedZone ? matchedZone.minOrder : Number(tenantData.delivery_min_order)

  if (deliveryType === 'delivery' && subtotal < minOrder) {
    throw createError({
      statusCode: 400,
      message: `Минимальная сумма заказа для доставки: ${minOrder} ₽`,
    })
  }

  // Серверная валидация промокода и автоматических акций — применяется лучшая скидка
  let discountAmount = 0
  let appliedPromoCode: string | null = body.promoCode ?? null

  // Промокод + автоматические акции — все три запроса параллельно
  const [{ data: promoResult }, { data: bestPromo }, { data: freeItemPromo }] = await Promise.all([
    body.promoCode
      ? supabase.rpc('check_promo_code', { p_tenant_id: tenantId, p_code: body.promoCode, p_subtotal: subtotal })
      : Promise.resolve({ data: null }),
    supabase.rpc('get_best_promotion', { p_tenant_id: tenantId, p_subtotal: subtotal }),
    supabase.rpc('get_free_item_promotion', { p_tenant_id: tenantId, p_subtotal: subtotal }),
  ])

  let promoCodeDiscount = 0
  if (promoResult?.valid) {
    const raw = promoResult.discount_type === 'percent'
      ? Math.round(subtotal * Number(promoResult.discount_value) / 100)
      : Number(promoResult.discount_value)

    promoCodeDiscount = Math.min(raw, subtotal)
  }

  // Автоматические акции
  let promotionDiscount = 0
  let appliedPromotionId: string | null = null

  if (bestPromo) {
    promotionDiscount = Number(bestPromo.discount_amount)
    appliedPromotionId = bestPromo.promotion_id as string
  }

  // Лучшая скидка побеждает
  if (promotionDiscount > promoCodeDiscount) {
    discountAmount = promotionDiscount
    appliedPromoCode = null // промокод не применён — акция выгоднее
  }
  else {
    discountAmount = promoCodeDiscount
    appliedPromotionId = null
  }

  const total = subtotal - discountAmount + deliveryFee

  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim()
    : null

  const { data, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      customer_name: body.customer.name,
      customer_phone: body.customer.phone,
      customer_email: body.customer.email ?? null,
      delivery_type: deliveryType,
      address: body.address ?? null,
      comment: body.comment ?? null,
      promo_code: appliedPromoCode,
      ...(appliedPromotionId && { promotion_id: appliedPromotionId }),
      discount_amount: discountAmount,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      status: 'new',
      payment_type: paymentType,
      ...(idempotencyKey && { idempotency_key: idempotencyKey }),
      ...(orderBranchId && { branch_id: orderBranchId }),
      ...(matchedZone && { delivery_zone_id: matchedZone.id }),
    })
    .select('id')
    .single()

  if (error) {
    // Дубль — заказ с таким idempotency key уже существует
    if (error.code === '23505' && idempotencyKey) {
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .eq('tenant_id', tenantId)
        .single()

      if (existing) return { id: existing.id }
    }

    throw createError({ statusCode: 500, message: error.message })
  }

  // Insert order items
  if (data) {
    const itemRows = serverItems.map((item: { dishId: string; dishName: string; categoryName?: string; price: number; quantity: number; removedIngredients: string[]; modifiers?: { groupName: string; optionName: string; priceDelta: number }[] }, i: number) => ({
      order_id: data.id,
      dish_id: item.dishId,
      dish_name: item.dishName,
      category_name: item.categoryName ?? null,
      price: item.price,
      quantity: item.quantity,
      removed_ingredients: item.removedIngredients ?? [],
      modifiers: item.modifiers ?? [],
      sort_order: i,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(itemRows)
    if (itemsError) {
      console.error('[order_items insert]', itemsError)
    }

    // Бесплатное блюдо (акция типа free_item)
    if (freeItemPromo) {
      const { error: freeItemError } = await supabase.from('order_items').insert({
        order_id: data.id,
        dish_id: freeItemPromo.free_dish_id as string,
        dish_name: freeItemPromo.dish_name as string,
        category_name: null,
        price: 0,
        quantity: 1,
        removed_ingredients: [],
        modifiers: [],
        sort_order: serverItems.length,
      })
      if (freeItemError) {
        console.error('[free_item insert]', freeItemError)
      }
    }
  }

  // Инкрементируем счётчик использований промокода (только если он победил)
  if (appliedPromoCode && discountAmount > 0) {
    await supabase.rpc('increment_promo_code_usage', {
      p_tenant_id: tenantId,
      p_code: appliedPromoCode,
    })
  }

  return { id: data.id }
})
