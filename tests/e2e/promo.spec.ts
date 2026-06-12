import { test, expect, request as pwRequest } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fixtures } from './fixtures'

// E2E критической трубы «промокоды + кампании» в приёме заказа.
//
// Две границы под тестом:
//   1) Валидация промокодов — ПРЯМОЙ вызов RPC check_promo_code (152) и
//      increment_promo_code_usage (042) service-role'ом. Это единственный
//      источник правды для «годен/не годен» (зовётся из resolvePromo под капотом
//      orders.post). HTTP тут не нужен — валидация чистая.
//   2) Применение промокода — ОДИН реальный HTTP POST /api/orders (pickup) с
//      promoCode: сервер пересчитывает скидку (order-promo/order-calc) и пишет
//      promo_code/discount_amount/total в orders + инкрементит used_count внутри
//      create_order_with_items_atomic (296, PREPROD-114).
//   3) Кампании — RPC get_best_promotion (154) с явным p_delivery_time для
//      детерминизма (иначе now() + tz тенанта).
//
// ⚠️ CI-сид (supabase/seed/e2e-ci.sql) содержит 0 promo_codes и 0 promotions →
// сеем СВОИ объекты service-role'ом и чистим по code-list/title. UUID/коды из
// живой локалки НЕ хардкодим — их в CI не существует.
//
// Тенант: demo (retail). check_promo_code/get_best_promotion/increment_* выданы
// service_role — owner-сессия здесь не нужна, всё через svc.

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ?? ''

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000002'
const DEMO_BRANCH_ID = 'ca634a0d-3848-4c10-800c-28f9fde25160'
// Маргарита: база 650 (сервер берёт из БД, клиентскую цену игнорит).
const MARGARITA_ID = '00000000-0000-0000-0005-000000000001'
const MARGARITA_PRICE = 650

// Маркеры для идемпотентного cleanup (переживаем крэш посреди прогона).
const ORDER_MARKER = 'E2E_PROMO'
const CAMPAIGN_TITLE = 'E2E_PROMO'
const PROMO_CODES = ['E2EVALID', 'E2EMIN', 'E2ELIMIT', 'E2EEXP']

const STOREFRONT_BASE = `http://${fixtures.retailTenantSlug}.localhost:4711`

// service-role клиент — seed/RPC/assert/cleanup в обход RLS.
const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// id засеянной кампании — нужен для ассерта promotion_id в тесте 7.
let seededPromotionId: string
// Посторонние активные кампании demo (дрейф живой локалки) глушим на время теста:
// get_best_promotion берёт победителя среди ВСЕХ активных, иначе чужая кампания ломает
// ассерт «ниже порога → null». Возвращаем в cleanup. В CI-сиде promotions пусто → no-op.
let deactivatedPromoIds: string[] = []

// Чистим наши promo_codes по code-list, кампанию по title-маркеру + возвращаем
// посторонние кампании, заглушённые на время теста.
async function cleanupPromos() {
  await svc.from('promo_codes').delete().eq('tenant_id', DEMO_TENANT_ID).in('code', PROMO_CODES)
  await svc.from('promotions').delete().eq('tenant_id', DEMO_TENANT_ID).eq('title', CAMPAIGN_TITLE)
  if (deactivatedPromoIds.length) {
    await svc.from('promotions').update({ active: true }).in('id', deactivatedPromoIds)
    deactivatedPromoIds = []
  }
}

// Чистим заказы файла leaf-first (FK: kitchen_queue → order_items → orders).
async function cleanupOrders() {
  const { data } = await svc
    .from('orders')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('comment', ORDER_MARKER)
  const ids = (data ?? []).map((o) => o.id as string)
  if (!ids.length) return

  await svc.from('kitchen_queue').delete().in('order_id', ids)
  await svc.from('order_items').delete().in('order_id', ids)
  await svc.from('orders').delete().in('id', ids)
}

// Сеем 4 промокода + 1 кампанию. Реседим перед каждым тестом → used_count всегда
// стартует с 0 (тест 5/6 инкрементят, реседd возвращает чистое состояние).
async function seedPromos() {
  const { error: codesErr } = await svc.from('promo_codes').insert([
    // used_count: 0 явно в КАЖДОМ — PostgREST при bulk-insert выравнивает колонки
    // по объединению ключей и НЕ применяет DEFAULT к пропущенным → иначе NOT NULL violation.
    // valid: 10% без ограничений.
    { tenant_id: DEMO_TENANT_ID, code: 'E2EVALID', discount_type: 'percent', discount_value: 10, active: true, used_count: 0 },
    // ниже минимума: fixed 200, min_order_amount 1500.
    { tenant_id: DEMO_TENANT_ID, code: 'E2EMIN', discount_type: 'fixed', discount_value: 200, active: true, min_order_amount: 1500, used_count: 0 },
    // лимит исчерпания: 15%, usage_limit 1, used_count 0.
    { tenant_id: DEMO_TENANT_ID, code: 'E2ELIMIT', discount_type: 'percent', discount_value: 15, active: true, usage_limit: 1, used_count: 0 },
    // протухший: active=true, но active_to в прошлом.
    { tenant_id: DEMO_TENANT_ID, code: 'E2EEXP', discount_type: 'fixed', discount_value: 100, active: true, active_to: '2020-01-01T00:00:00Z', used_count: 0 },
  ])
  if (codesErr) throw new Error(`seed promo_codes failed: ${codesErr.message}`)

  // Кампания min_order: 10% при subtotal ≥ 500 (conditions snake_case).
  const { data: promo, error: promoErr } = await svc
    .from('promotions')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      title: CAMPAIGN_TITLE,
      discount_type: 'percent',
      discount_value: 10,
      active: true,
      type: 'min_order',
      conditions: { min_order_amount: 500 },
    })
    .select('id')
    .single()
  if (promoErr) throw new Error(`seed promotion failed: ${promoErr.message}`)
  seededPromotionId = promo!.id as string

  // Глушим посторонние активные кампании (наша остаётся единственной активной), чтобы
  // get_best_promotion детерминированно возвращал НАШУ или null. Дрейф живой локалки;
  // в CI promotions пусто → strays пустой, no-op. Возврат — в cleanupPromos.
  const { data: strays } = await svc
    .from('promotions')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('active', true)
    .is('deleted_at', null)
    .neq('id', seededPromotionId)
  deactivatedPromoIds = (strays ?? []).map((p) => p.id as string)
  if (deactivatedPromoIds.length) {
    await svc.from('promotions').update({ active: false }).in('id', deactivatedPromoIds)
  }
}

test.beforeEach(async () => {
  // Любой HTTP-тест с POST копит auth_rate_limits (orders:tenant-ip / orders:ip).
  // Локально x-real-ip игнорится (TRUST_PROXY off) → чистим бакеты, иначе 429.
  await svc.from('auth_rate_limits').delete().like('key', 'orders:%')
  await cleanupOrders()
  // Реседим промо начисто перед каждым тестом — used_count детерминирован.
  await cleanupPromos()
  await seedPromos()
})

test.afterAll(async () => {
  await cleanupOrders()
  await cleanupPromos()
})

// ── 1. valid: годный промокод → discount_type/value ──────────────────────────
test('check_promo_code: годный код → valid с типом и значением скидки', async () => {
  const { data, error } = await svc.rpc('check_promo_code', {
    p_tenant_id: DEMO_TENANT_ID,
    p_code: 'E2EVALID',
    p_subtotal: 650,
  })
  expect(error, error?.message).toBeNull()
  expect(data).toMatchObject({ valid: true, discount_type: 'percent', discount_value: 10 })
})

// ── 2. not found: несуществующий код → valid:false ───────────────────────────
test('check_promo_code: несуществующий код → valid:false', async () => {
  const { data, error } = await svc.rpc('check_promo_code', {
    p_tenant_id: DEMO_TENANT_ID,
    p_code: 'NETU',
    p_subtotal: 650,
  })
  expect(error, error?.message).toBeNull()
  expect(data).toMatchObject({ valid: false })
})

// ── 3. ниже минимума → valid:false + min_order_amount; на пороге → valid ──────
test('check_promo_code: ниже min_order_amount → valid:false с порогом, на пороге → valid', async () => {
  const { data: below, error: belowErr } = await svc.rpc('check_promo_code', {
    p_tenant_id: DEMO_TENANT_ID,
    p_code: 'E2EMIN',
    p_subtotal: 1000,
  })
  expect(belowErr, belowErr?.message).toBeNull()
  expect(below).toMatchObject({ valid: false, min_order_amount: 1500 })

  const { data: ok, error: okErr } = await svc.rpc('check_promo_code', {
    p_tenant_id: DEMO_TENANT_ID,
    p_code: 'E2EMIN',
    p_subtotal: 1500,
  })
  expect(okErr, okErr?.message).toBeNull()
  expect(ok).toMatchObject({ valid: true, discount_type: 'fixed', discount_value: 200 })
})

// ── 4. expired: active_to в прошлом → valid:false ────────────────────────────
test('check_promo_code: протухший код (active_to в прошлом) → valid:false', async () => {
  const { data, error } = await svc.rpc('check_promo_code', {
    p_tenant_id: DEMO_TENANT_ID,
    p_code: 'E2EEXP',
    p_subtotal: 650,
  })
  expect(error, error?.message).toBeNull()
  expect(data).toMatchObject({ valid: false })
})

// ── 5. usage limit: валиден при used=0; после инкремента (used→limit) → false ─
test('check_promo_code + increment_promo_code_usage: исчерпание лимита делает код невалидным', async () => {
  // usage_limit=1, used_count=0 → пока годен.
  const { data: before, error: beforeErr } = await svc.rpc('check_promo_code', {
    p_tenant_id: DEMO_TENANT_ID,
    p_code: 'E2ELIMIT',
    p_subtotal: 650,
  })
  expect(beforeErr, beforeErr?.message).toBeNull()
  expect(before).toMatchObject({ valid: true })

  // Списываем единственное использование напрямую UPDATE'ом (used_count 0 → 1 ==
  // usage_limit). Отдельной RPC increment_promo_code_usage в схеме НЕТ — used_count
  // инкрементит create_order_with_items_atomic при заказе с кодом (это проверяет тест 6).
  // Здесь предмет — реакция check_promo_code на исчерпанный лимит.
  const { error: incErr } = await svc
    .from('promo_codes')
    .update({ used_count: 1 })
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('code', 'E2ELIMIT')
  expect(incErr, incErr?.message).toBeNull()

  // Теперь used_count >= usage_limit → код больше не годен.
  const { data: after, error: afterErr } = await svc.rpc('check_promo_code', {
    p_tenant_id: DEMO_TENANT_ID,
    p_code: 'E2ELIMIT',
    p_subtotal: 650,
  })
  expect(afterErr, afterErr?.message).toBeNull()
  expect(after).toMatchObject({ valid: false })
})

// ── 6. применение: HTTP POST с promoCode → скидка/total в orders + used_count++ ─
test('POST /api/orders с promoCode: скидка пишется в заказ, used_count инкрементится', async () => {
  // used_count промокода ДО заказа (после реседа beforeEach == 0).
  const { data: codeBefore } = await svc
    .from('promo_codes')
    .select('used_count')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('code', 'E2EVALID')
    .single()
  const usedBefore = Number(codeBefore!.used_count)

  // Свой x-real-ip (10.13.0.x, .1–.12 заняты) → отдельный бакет rate-limit в CI.
  const ctx = await pwRequest.newContext({
    baseURL: STOREFRONT_BASE,
    extraHTTPHeaders: { 'x-real-ip': '10.13.0.20' },
  })
  const res = await ctx.post('/api/orders', {
    data: {
      deliveryType: 'pickup',
      branchId: DEMO_BRANCH_ID,
      customer: { phone: '+79991234567' },
      paymentType: 'cash',
      comment: ORDER_MARKER,
      items: [{ dishId: MARGARITA_ID, dishName: 'Маргарита', quantity: 1, removedIngredients: [] }],
      promoCode: 'E2EVALID',
    },
  })
  expect(res.status(), await res.text()).toBe(200)
  const payload = await res.json()
  expect(payload.id).toBeTruthy()
  await ctx.dispose()

  // Сервер пересчитал: subtotal 650, скидка 10% = 65, total 585. promo_code годен
  // и побеждает кампанию (тоже 10% → ничья, при ничьей выигрывает код, см.
  // calcPromoDiscount: promotionDiscount > promoCodeDiscount строгое).
  const { data: order } = await svc
    .from('orders')
    .select('promo_code, discount_amount, subtotal, total')
    .eq('id', payload.id)
    .single()
  expect(order!.promo_code).toBe('E2EVALID')
  expect(Number(order!.subtotal)).toBe(MARGARITA_PRICE)
  expect(Number(order!.discount_amount)).toBe(65)
  expect(Number(order!.total)).toBe(585)

  // used_count инкрементнулся внутри create_order_with_items_atomic (PREPROD-114).
  const { data: codeAfter } = await svc
    .from('promo_codes')
    .select('used_count')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('code', 'E2EVALID')
    .single()
  expect(Number(codeAfter!.used_count)).toBe(usedBefore + 1)
})

// ── 7. кампания: get_best_promotion с явным p_delivery_time (детерминизм) ─────
test('get_best_promotion: min_order-кампания применяется выше порога, ниже — null', async () => {
  // Фиксированное время доставки → детерминизм (у min_order нет time/weekday
  // условий, но передаём явно, чтобы не зависеть от now() и tz тенанта).
  const deliveryTime = '2026-06-12T09:00:00Z'

  // subtotal 600 ≥ 500 → 10% = 60, наша засеянная кампания (в CI единственная).
  const { data: best, error: bestErr } = await svc.rpc('get_best_promotion', {
    p_tenant_id: DEMO_TENANT_ID,
    p_subtotal: 600,
    p_delivery_time: deliveryTime,
  })
  expect(bestErr, bestErr?.message).toBeNull()
  expect(best).toMatchObject({ promotion_id: seededPromotionId, discount_amount: 60 })

  // subtotal 400 < 500 → условие min_order_amount не проходит → null.
  const { data: none, error: noneErr } = await svc.rpc('get_best_promotion', {
    p_tenant_id: DEMO_TENANT_ID,
    p_subtotal: 400,
    p_delivery_time: deliveryTime,
  })
  expect(noneErr, noneErr?.message).toBeNull()
  expect(none).toBeNull()
})

// ── 8. [опц.] happy_hour детерминизм ─────────────────────────────────────────
// TODO: покрыть time-window кампанию (type='happy_hour', conditions
// {time_from,time_to}). get_best_promotion конвертит p_delivery_time в локальное
// время тенанта (tenants.timezone) перед сравнением с time_from/time_to → для
// детерминизма нужно:
//   1) прочитать tenants.timezone у demo;
//   2) построить p_delivery_time так, чтобы локальное время попадало В окно
//      (срабатывает) и ВНЕ окна (не она);
//   3) сеять happy_hour ТОЛЬКО внутри этого теста с собственным cleanup —
//      always-on happy_hour в beforeEach сломал бы тест 6 (get_best_promotion
//      вернул бы 20% > 65 → промокод перестал бы побеждать, promo_code=null).
// Возни с tz/окнами много, ценность сверх теста 7 низкая → fixme.
test.fixme('get_best_promotion: happy_hour срабатывает в окне и не срабатывает вне (нужен tz-детерминизм)', async () => {
  // intentionally empty — см. TODO выше
})
