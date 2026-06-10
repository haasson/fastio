import { test, expect, request as pwRequest } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fixtures } from './fixtures'

// Task 9 — E2E критического dine-in флоу «стол = один редактируемый чек».
//
// Интеграционный e2e: гостевой (горячий) путь идёт ЧЕРЕЗ реальный HTTP
// `POST /api/orders` (deliveryType dine_in) на storefront demo-тенанта; действия
// персонала (открыть/официант-дописал/расчёт) — через RPC под owner-сессией
// (open_table_check / add_items_to_check confirmed / settle_table_check), как их
// дёргает админка. Ассертим состояние БД service-role клиентом. Admin-UI харнесса
// для столов нет → RPC+HTTP-уровень корректен и покрывает «заказ без потерь».
//
// Тенант: demo (retail, kitchen+dineIn включены, dine_in_ordering_enabled=true).
// Owner demo@fastio.app (role_id NULL → все права) — пароль ресетит setup.mjs.
// Стол: выделенный E2E-стол с фиксированным UUID, пересоздаётся в beforeAll и
// чистится в afterAll, чтобы не зависеть от ручных тестовых столов в demo.

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const SERVICE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ?? 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000002'
const DEMO_BRANCH_ID = 'ca634a0d-3848-4c10-800c-28f9fde25160'
// Выделенный E2E-стол (фикс. UUID — легко чистить, не пересекается с ручными).
const E2E_TABLE_ID = 'e2e7ab1e-0000-0000-0000-000000000007'
const E2E_TABLE_NAME = 'E2E dine-in стол'

// Маргарита: requires_kitchen=true → попадает в kitchen_queue. price 650.
const MARGARITA_ID = '00000000-0000-0000-0005-000000000001'
const MARGARITA_PRICE = 650

const STOREFRONT_BASE = `http://${fixtures.retailTenantSlug}.localhost:4711`

// service-role клиент — setup/assert/cleanup в обход RLS.
const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// owner-authed клиент — вызывает permission-gated RPC (has_permission видит auth.uid()).
let owner: SupabaseClient

// HTTP-контракт (storefront body): camelCase, price считает сервер.
const httpDish = (qty = 1) => ({
  dishId: MARGARITA_ID,
  dishName: 'Маргарита',
  quantity: qty,
  removedIngredients: [],
})

// RPC-контракт add_items_to_check (миграция 327): snake_case, price/quantity явно.
const rpcDish = (qty = 1) => ({
  dish_id: MARGARITA_ID,
  dish_name: 'Маргарита',
  price: MARGARITA_PRICE,
  quantity: qty,
})

// Полная очистка состояния E2E-стола: чеки, их позиции/кухня (FK leaf-first), стол.
async function resetTable() {
  const { data: checks } = await svc.from('orders').select('id').eq('table_id', E2E_TABLE_ID)
  const ids = (checks ?? []).map((c) => c.id as string)
  if (ids.length > 0) {
    await svc.from('kitchen_queue').delete().in('order_id', ids)
    await svc.from('order_items').delete().in('order_id', ids)
    await svc.from('orders').delete().in('id', ids)
  }
  await svc.from('tables').delete().eq('id', E2E_TABLE_ID)
}

// Открыть стол под нужным is_open. Стол всегда привязан к филиалу (D-11).
async function seedTable(isOpen: boolean) {
  await resetTable()
  const { error } = await svc.from('tables').insert({
    id: E2E_TABLE_ID,
    tenant_id: DEMO_TENANT_ID,
    branch_id: DEMO_BRANCH_ID,
    name: E2E_TABLE_NAME,
    is_active: true,
    is_open: isOpen,
    opened_at: isOpen ? new Date().toISOString() : null,
  })
  if (error) throw new Error(`seedTable failed: ${error.message}`)
}

test.beforeAll(async () => {
  owner = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await owner.auth.signInWithPassword({
    email: fixtures.adminEmail,
    password: fixtures.adminPassword,
  })
  if (error) throw new Error(`owner sign-in failed: ${error.message}`)
})

test.afterAll(async () => {
  await resetTable()
  await owner?.auth.signOut()
})

// ── 1. Открытие стола → ровно один открытый чек ──────────────────────────────
test('open_table_check: ровно один открытый чек, стол открыт, повторный open падает', async () => {
  await seedTable(false)

  const { data: checkId, error } = await owner.rpc('open_table_check', { p_table_id: E2E_TABLE_ID })
  expect(error, error?.message).toBeNull()
  expect(checkId).toBeTruthy()

  const { data: openChecks } = await svc
    .from('orders')
    .select('id, check_status, delivery_type, status')
    .eq('table_id', E2E_TABLE_ID)
    .eq('check_status', 'open')
  expect(openChecks).toHaveLength(1)
  expect(openChecks![0].id).toBe(checkId)
  expect(openChecks![0].delivery_type).toBe('dine_in')

  const { data: table } = await svc.from('tables').select('is_open').eq('id', E2E_TABLE_ID).single()
  expect(table!.is_open).toBe(true)

  // Bonus: второй open ловит партиал-уникальный индекс → P0001.
  const { error: dupError } = await owner.rpc('open_table_check', { p_table_id: E2E_TABLE_ID })
  expect(dupError).not.toBeNull()
})

// ── 2. Официант дописывает 2 блюда → один чек, 2 позиции, верный total, кухня ─
test('add_items_to_check confirmed: два вызова → один чек с 2 позициями + кухня', async () => {
  await seedTable(false)
  const { data: checkId } = await owner.rpc('open_table_check', { p_table_id: E2E_TABLE_ID })

  const { error: e1 } = await owner.rpc('add_items_to_check', {
    p_table_id: E2E_TABLE_ID,
    p_items_json: [rpcDish(1)],
    p_status: 'confirmed',
  })
  expect(e1, e1?.message).toBeNull()

  const { error: e2 } = await owner.rpc('add_items_to_check', {
    p_table_id: E2E_TABLE_ID,
    p_items_json: [rpcDish(1)],
    p_status: 'confirmed',
  })
  expect(e2, e2?.message).toBeNull()

  // Все позиции в ОДНОМ чеке.
  const { data: openChecks } = await svc
    .from('orders')
    .select('id, total, subtotal')
    .eq('table_id', E2E_TABLE_ID)
    .eq('check_status', 'open')
  expect(openChecks).toHaveLength(1)
  expect(openChecks![0].id).toBe(checkId)

  const { data: items } = await svc.from('order_items').select('id, status, price, quantity').eq('order_id', checkId)
  expect(items).toHaveLength(2)
  expect(items!.every((i) => i.status === 'confirmed')).toBe(true)

  // total = сумма позиций (2 × 650).
  expect(Number(openChecks![0].total)).toBe(MARGARITA_PRICE * 2)
  expect(Number(openChecks![0].subtotal)).toBe(MARGARITA_PRICE * 2)

  // Kitchen on → confirmed-позиции в очереди (Маргарита requires_kitchen).
  const { data: kq } = await svc.from('kitchen_queue').select('id, status').eq('order_id', checkId)
  expect(kq!.length).toBeGreaterThanOrEqual(2)
})

// ── 3. QR-гость на ОТКРЫТОМ столе → pending (без кухни) → confirm → кухня ─────
test('QR-гость dine_in (HTTP): pending, без кухни; после confirm → kitchen_queue', async () => {
  await seedTable(false)
  const { data: checkId } = await owner.rpc('open_table_check', { p_table_id: E2E_TABLE_ID })

  // Свой x-real-ip (.7) → отдельный rate-limit-бакет. fastio_table-cookie
  // (= table_id) имитирует QR-скан — IDOR-гард в orders.post требует его.
  const ctx = await pwRequest.newContext({
    baseURL: STOREFRONT_BASE,
    extraHTTPHeaders: {
      'x-real-ip': '10.7.0.7',
      cookie: `fastio_table=${E2E_TABLE_ID}`,
    },
  })
  const res = await ctx.post('/api/orders', {
    data: { deliveryType: 'dine_in', tableId: E2E_TABLE_ID, items: [httpDish(1)] },
  })
  expect(res.status(), await res.text()).toBe(200)
  const payload = await res.json()
  // Гость дописывает в существующий чек — id чека возвращается, без orderNumber/token.
  expect(payload.id).toBe(checkId)
  await ctx.dispose()

  // Позиция pending, кухни по ней пока нет.
  const { data: pendingItems } = await svc
    .from('order_items')
    .select('id, status')
    .eq('order_id', checkId)
    .eq('status', 'pending')
  expect(pendingItems).toHaveLength(1)
  const pendingItemId = pendingItems![0].id

  const { data: kqBefore } = await svc.from('kitchen_queue').select('id').eq('order_item_id', pendingItemId)
  expect(kqBefore).toHaveLength(0)

  // Персонал подтверждает позицию (pending → confirmed) — триггер кладёт на кухню.
  const { error: confErr } = await svc
    .from('order_items')
    .update({ status: 'confirmed' })
    .eq('id', pendingItemId)
  expect(confErr, confErr?.message).toBeNull()

  const { data: kqAfter } = await svc.from('kitchen_queue').select('id, status').eq('order_item_id', pendingItemId)
  expect(kqAfter!.length).toBeGreaterThanOrEqual(1)
})

// ── 4. QR-гость на ЗАКРЫТОМ столе → 400 (гард is_open) ───────────────────────
test('QR-гость dine_in (HTTP) на закрытом столе → 400', async () => {
  await seedTable(false) // is_open=false, чек НЕ открываем

  // Cookie на месте (честный QR-скан) — 400 прилетает от is_open-гарда, не от IDOR.
  const ctx = await pwRequest.newContext({
    baseURL: STOREFRONT_BASE,
    extraHTTPHeaders: {
      'x-real-ip': '10.7.0.8',
      cookie: `fastio_table=${E2E_TABLE_ID}`,
    },
  })
  const res = await ctx.post('/api/orders', {
    data: { deliveryType: 'dine_in', tableId: E2E_TABLE_ID, items: [httpDish(1)] },
  })
  expect(res.status()).toBe(400)
  await ctx.dispose()

  // Ничего не создалось.
  const { data: checks } = await svc.from('orders').select('id').eq('table_id', E2E_TABLE_ID)
  expect(checks).toHaveLength(0)
})

// ── 5. Расчёт: settle со скидкой и оплатой картой ────────────────────────────
test('settle_table_check: settled, total = subtotal − discount, стол закрыт', async () => {
  await seedTable(false)
  const { data: checkId } = await owner.rpc('open_table_check', { p_table_id: E2E_TABLE_ID })
  await owner.rpc('add_items_to_check', {
    p_table_id: E2E_TABLE_ID,
    p_items_json: [rpcDish(2)], // subtotal = 1300
    p_status: 'confirmed',
  })

  const discount = 100
  const { error } = await owner.rpc('settle_table_check', {
    p_check_id: checkId,
    p_discount_amount: discount,
    p_payment_type: 'card',
  })
  expect(error, error?.message).toBeNull()

  const { data: check } = await svc
    .from('orders')
    .select('check_status, payment_type, subtotal, discount_amount, total')
    .eq('id', checkId)
    .single()
  const subtotal = MARGARITA_PRICE * 2
  expect(check!.check_status).toBe('settled')
  expect(check!.payment_type).toBe('card')
  expect(Number(check!.subtotal)).toBe(subtotal)
  expect(Number(check!.discount_amount)).toBe(discount)
  expect(Number(check!.total)).toBe(subtotal - discount)

  const { data: table } = await svc.from('tables').select('is_open').eq('id', E2E_TABLE_ID).single()
  expect(table!.is_open).toBe(false)
})

// ── 6. Пустой чек → cancelled, стол закрыт, не в истории ─────────────────────
test('settle пустого чека → cancelled, стол закрыт, не settled', async () => {
  await seedTable(false)
  const { data: checkId } = await owner.rpc('open_table_check', { p_table_id: E2E_TABLE_ID })

  const { error } = await owner.rpc('settle_table_check', {
    p_check_id: checkId,
    p_discount_amount: 0,
    p_payment_type: 'cash',
  })
  expect(error, error?.message).toBeNull()

  const { data: check } = await svc
    .from('orders')
    .select('check_status, total')
    .eq('id', checkId)
    .single()
  expect(check!.check_status).toBe('cancelled')
  expect(Number(check!.total)).toBe(0)

  const { data: table } = await svc.from('tables').select('is_open').eq('id', E2E_TABLE_ID).single()
  expect(table!.is_open).toBe(false)
})

// ── 7. История: settled-чек возвращается запросом listTableSessions ──────────
test('история стола: settled-чек виден как ровно одна строка с верными суммами', async () => {
  await seedTable(false)
  const { data: checkId } = await owner.rpc('open_table_check', { p_table_id: E2E_TABLE_ID })
  await owner.rpc('add_items_to_check', {
    p_table_id: E2E_TABLE_ID,
    p_items_json: [rpcDish(2)],
    p_status: 'confirmed',
  })
  const discount = 50
  await owner.rpc('settle_table_check', {
    p_check_id: checkId,
    p_discount_amount: discount,
    p_payment_type: 'card',
  })

  // Тот же запрос что в orders.api listTableSessions: check_status='settled',
  // table_id NOT NULL, inner-join tables, дневные границы (по created_at).
  const now = new Date()
  const dayFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const dayTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()

  const { data: rows, error } = await svc
    .from('orders')
    .select('id, total, subtotal, discount_amount, payment_type, check_status, table_id, tables!inner(branch_id)')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('check_status', 'settled')
    .not('table_id', 'is', null)
    .eq('table_id', E2E_TABLE_ID)
    .gte('created_at', dayFrom)
    .lt('created_at', dayTo)
  expect(error, error?.message).toBeNull()

  expect(rows).toHaveLength(1)
  const subtotal = MARGARITA_PRICE * 2
  expect(rows![0].id).toBe(checkId)
  expect(Number(rows![0].total)).toBe(subtotal - discount)
  expect(Number(rows![0].discount_amount)).toBe(discount)
  expect(rows![0].payment_type).toBe('card')
})
