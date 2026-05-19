import { randomUUID } from 'node:crypto'
import { validateAndNormalizeRussianPhone } from '@fastio/shared'
import type { Tenant } from '@fastio/shared'
import { getTenantDb } from '../utils/tenantDb'
import { getClientIp } from '../utils/clientIp'
import { enforceRateLimit } from '../utils/enforceRateLimit'
import { reportError } from '~/shared/utils/reportError'
import { validateBasicFields, fetchOrderInitialData, validateModulesForDeliveryType, validatePaymentMethod } from '../services/order-validation'
import { resolveCustomer } from '../services/order-customer'
import { resolveDelivery } from '../services/order-delivery'
import { validateAndBuildItems } from '../services/order-items'
import { resolvePromo } from '../services/order-promo'
import { calcOrderTotal } from '../services/order-calc'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const { tenantId } = db

  const ip = getClientIp(event)
  // Global per-IP cap + per-(tenant, IP) — защита от спам-заказов на N тенантов
  // с одного IP. Подробнее CR-01 в REVIEW PREPROD-102.
  await enforceRateLimit(
    [
      { key: `orders:ip:${ip}`, max: 15, windowSeconds: 60 },
      { key: `orders:tenant-ip:${tenantId}:${ip}`, max: 5, windowSeconds: 60 },
    ],
    'Слишком много запросов. Попробуйте позже.',
  )

  const body = await readBody(event)
  const supabase = db.raw

  // 1. Валидация входных данных
  const { deliveryType, paymentType } = validateBasicFields(body)

  // Нормализуем телефон один раз на входе через shared-утилку.
  // Раньше делали normalizePhone без проверки длины — сохраняли мусор вроде
  // '123' / '79' в customer_phone. Теперь — единый канон '7XXXXXXXXXX' или 400.
  // Гость без логина может пропустить телефон (null), а вот непустой невалидный
  // — это уже ошибка ввода, отбиваем сразу.
  const rawCustomerPhone = typeof body.customer?.phone === 'string' ? body.customer.phone.trim() : ''
  let normalizedCustomerPhone: string | null = null
  if (rawCustomerPhone) {
    normalizedCustomerPhone = validateAndNormalizeRussianPhone(rawCustomerPhone)
    if (!normalizedCustomerPhone) {
      throw createError({ statusCode: 400, message: 'Некорректный номер телефона' })
    }
  }

  // 2. Данные тенанта + начальный статус + резолв клиента (параллельно)
  const authHeader = getRequestHeader(event, 'authorization')
  const [{ tenantConfig, initialStatusId }, { customerId, authUserId }] = await Promise.all([
    fetchOrderInitialData(supabase, tenantId),
    resolveCustomer(supabase, tenantId, authHeader),
  ])

  validateModulesForDeliveryType(deliveryType, tenantConfig.modules)
  validatePaymentMethod(paymentType, tenantConfig.paymentMethods)

  // 3. Валидация блюд, модификаторов, пересчёт цен
  const { serverItems, subtotal, comboItemsMap } = await validateAndBuildItems(supabase, tenantId, body.items)

  // 4. Доставка: зоны, филиал, стоимость, стол
  const tenant = event.context.tenant as Tenant
  const { matchedZone, branchId, deliveryFee, tableRecord, deliveryLat, deliveryLon } = await resolveDelivery(
    supabase, tenantId, deliveryType, body, tenantConfig, subtotal,
    { workingHoursSchedule: tenant.workingHoursSchedule, timezone: tenant.timezone },
  )

  // 5. Валидация scheduledAt (нужна до проверки промо, чтобы передать время доставки)
  let validScheduledAt: string | null = null
  if (typeof body.scheduledAt === 'string' && body.scheduledAt) {
    const ts = Date.parse(body.scheduledAt)
    if (Number.isNaN(ts) || ts < Date.now()) {
      throw createError({ statusCode: 400, message: 'Некорректная дата предзаказа' })
    }
    validScheduledAt = new Date(ts).toISOString()
  }

  // 6. Промокоды и акции — валидируем против времени доставки (предзаказ) или текущего времени
  const { discountAmount, appliedPromoCode, appliedPromotionId, freeItemPromo } = await resolvePromo(
    supabase, tenantId, body.promoCode ?? null, subtotal, validScheduledAt,
  )

  const total = calcOrderTotal(subtotal, discountAmount, deliveryFee)

  // 7. Создание заказа
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim()
    : null

  // IDOR guard: для гостевых заказов генерим token, который клиент пробрасывает в ?t=
  // при чтении. Залогиненный customer защищён через match auth.user.id ↔ orders.customer_id.
  const guestToken = customerId ? null : randomUUID()

  const orderPayload: Record<string, unknown> = {
    tenant_id: tenantId,
    customer_name: body.customer?.name ?? null,
    customer_phone: normalizedCustomerPhone,
    customer_email: body.customer?.email ?? null,
    delivery_type: deliveryType,
    address: body.address ?? null,
    entrance: body.entrance ?? null,
    floor: body.floor ?? null,
    apartment: body.apartment ?? null,
    intercom: body.intercom ?? null,
    comment: body.comment ?? null,
    promo_code: appliedPromoCode,
    promotion_id: appliedPromotionId ?? null,
    discount_amount: discountAmount,
    subtotal,
    delivery_fee: deliveryFee,
    total,
    status: initialStatusId,
    payment_type: paymentType,
    needs_change: paymentType === 'cash' && body.needsChange === true,
    change_from: paymentType === 'cash' && body.needsChange === true && typeof body.changeFrom === 'number' && body.changeFrom > total
      ? body.changeFrom
      : null,
    idempotency_key: idempotencyKey,
    branch_id: branchId ?? null,
    delivery_zone_id: matchedZone?.id ?? null,
    delivery_lat: deliveryLat,
    delivery_lon: deliveryLon,
    table_id: tableRecord?.id ?? null,
    table_name: tableRecord?.name ?? null,
    customer_id: customerId,
    guest_token: guestToken,
    scheduled_at: validScheduledAt,
  }

  const itemsPayload = serverItems.map((item, i) => ({
    dish_id: item.dishId,
    combo_id: item.comboId ?? null,
    combo_items: item.comboId ? (comboItemsMap.get(item.comboId) ?? null) : null,
    dish_name: item.dishName,
    category_name: item.categoryName ?? null,
    price: item.price,
    quantity: item.quantity,
    removed_ingredients: item.removedIngredients ?? [],
    modifiers: item.modifiers ?? [],
    addons: item.addons ?? [],
    sort_order: i,
    status: deliveryType === 'dine_in' ? 'pending' : 'confirmed',
    added_by: authUserId,
  }))

  const freeItemPayload = freeItemPromo ? {
    dish_id: freeItemPromo.free_dish_id,
    dish_name: freeItemPromo.dish_name,
    category_name: null,
    price: 0,
    quantity: 1,
    sort_order: serverItems.length,
  } : null

  // PREPROD-114: promo_code инкрементится внутри RPC в той же транзакции
  // что и INSERT INTO orders. Раньше делали отдельный increment_promo_code_usage
  // после успешного create — на worker crash между этими шагами оставался
  // order без инкремента used_count.
  const { data: rpcResult, error } = await supabase.rpc('create_order_with_items_atomic', {
    p_order_payload: orderPayload,
    p_items_json: itemsPayload,
    p_free_item_json: freeItemPayload,
    p_promo_code: appliedPromoCode && discountAmount > 0 ? appliedPromoCode : null,
  })

  if (error) {
    if (error.code === '23505' && idempotencyKey) {
      // Безопасно отдавать guest_token владельцу повторной попытки: idempotency_key —
      // 122-битный UUID, генерируется на клиенте через crypto.randomUUID() и известен
      // ТОЛЬКО оригинальному автору запроса. Угадать его ради phishing'а PII чужого
      // заказа невозможно. НЕ логировать idempotency_key в открытом виде.
      const { data: existing } = await db
        .from('orders')
        .select('id, order_number, guest_token')
        .eq('idempotency_key', idempotencyKey)
        .single()

      if (existing) {
        return {
          id: existing.id,
          orderNumber: existing.order_number ?? null,
          token: (existing.guest_token as string | null) ?? null,
        }
      }
    }

    reportError(error)
    throw createError({ statusCode: 500, message: 'Не удалось создать заказ' })
  }

  const result = rpcResult as { id: string; order_number: string | null; guest_token: string | null } | null

  if (!result) {
    reportError(new Error('[orders.post] RPC returned empty result'))
    throw createError({ statusCode: 500, message: 'Не удалось создать заказ' })
  }

  // Инкремент used_count промокода теперь делает create_order_with_items_atomic
  // в той же транзакции (см. p_promo_code выше) — PREPROD-114.

  return {
    id: result.id,
    orderNumber: result.order_number ?? null,
    token: result.guest_token ?? null,
  }
})
