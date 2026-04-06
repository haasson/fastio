import { normalizePhone } from '@fastio/shared'
import { getServerSupabase } from '../utils/supabase'
import { createRateLimiter } from '../utils/rateLimit'
import { validateBasicFields, fetchOrderInitialData, validateModulesForDeliveryType } from '../services/order-validation'
import { resolveCustomer } from '../services/order-customer'
import { resolveDelivery } from '../services/order-delivery'
import { validateAndBuildItems } from '../services/order-items'
import { resolvePromo } from '../services/order-promo'

const orderRateLimiter = createRateLimiter(5, 60_000)

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!orderRateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const body = await readBody(event)
  const supabase = getServerSupabase()

  // 1. Валидация входных данных
  const { deliveryType, paymentType } = validateBasicFields(body)

  // 2. Данные тенанта + начальный статус + резолв клиента (параллельно)
  const authHeader = getRequestHeader(event, 'authorization')
  const [{ tenantConfig, initialStatusId }, { customerId, authUserId }] = await Promise.all([
    fetchOrderInitialData(supabase, tenantId),
    resolveCustomer(supabase, tenantId, authHeader),
  ])

  validateModulesForDeliveryType(deliveryType, tenantConfig.modules)

  // 3. Валидация блюд, модификаторов, пересчёт цен
  const { serverItems, subtotal, comboItemsMap } = await validateAndBuildItems(supabase, tenantId, body.items)

  // 4. Доставка: зоны, филиал, стоимость, стол
  const { matchedZone, branchId, deliveryFee, tableRecord } = await resolveDelivery(
    supabase, tenantId, deliveryType, body, tenantConfig, subtotal,
  )

  // 5. Промокоды и акции
  const { discountAmount, appliedPromoCode, appliedPromotionId, freeItemPromo } = await resolvePromo(
    supabase, tenantId, body.promoCode ?? null, subtotal,
  )

  const total = subtotal - discountAmount + deliveryFee

  // 6. Создание заказа
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim()
    : null

  const { data, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      customer_name: body.customer?.name ?? null,
      customer_phone: body.customer?.phone ? normalizePhone(body.customer.phone) : null,
      customer_email: body.customer?.email ?? null,
      delivery_type: deliveryType,
      address: body.address ?? null,
      comment: body.comment ?? null,
      promo_code: appliedPromoCode,
      ...(appliedPromotionId && { promotion_id: appliedPromotionId }),
      discount_amount: discountAmount,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      status: initialStatusId,
      payment_type: paymentType,
      ...(idempotencyKey && { idempotency_key: idempotencyKey }),
      ...(branchId && { branch_id: branchId }),
      ...(matchedZone && { delivery_zone_id: matchedZone.id }),
      ...(tableRecord && { table_id: tableRecord.id, table_name: tableRecord.name }),
      ...(customerId && { customer_id: customerId }),
    })
    .select('id, order_number')
    .single()

  if (error) {
    if (error.code === '23505' && idempotencyKey) {
      const { data: existing } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('idempotency_key', idempotencyKey)
        .eq('tenant_id', tenantId)
        .single()

      if (existing) return { id: existing.id, orderNumber: existing.order_number ?? null }
    }

    throw createError({ statusCode: 500, message: error.message })
  }

  // 7. Создание позиций заказа
  if (data) {
    const itemRows = serverItems.map((item, i) => ({
      order_id: data.id,
      dish_id: item.dishId,
      combo_id: item.comboId ?? null,
      combo_items: item.comboId ? (comboItemsMap.get(item.comboId) ?? null) : null,
      dish_name: item.dishName,
      category_name: item.categoryName ?? null,
      price: item.price,
      quantity: item.quantity,
      removed_ingredients: item.removedIngredients ?? [],
      modifiers: item.modifiers ?? [],
      sort_order: i,
      status: deliveryType === 'dine_in' ? 'pending' : 'confirmed',
      added_by: authUserId,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(itemRows)
    if (itemsError) {
      console.error('[order_items insert]', itemsError)
    }

    // Бесплатное блюдо (акция типа free_item)
    if (freeItemPromo) {
      const { error: freeItemError } = await supabase.from('order_items').insert({
        order_id: data.id,
        dish_id: freeItemPromo.free_dish_id,
        dish_name: freeItemPromo.dish_name,
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

  // 8. Инкремент использований промокода
  if (appliedPromoCode && discountAmount > 0) {
    await supabase.rpc('increment_promo_code_usage', {
      p_tenant_id: tenantId,
      p_code: appliedPromoCode,
    })
  }

  return { id: data.id, orderNumber: data.order_number ?? null }
})
