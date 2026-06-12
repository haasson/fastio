import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fixtures } from './fixtures'

// E2E критического kitchen-флоу «заказ готовится без потерь».
//
// Тестируем границу БД/триггеров — ровно ту, где жили баги Phase 06 (soft-cancel,
// lifecycle 304/306). Admin-UI харнесса для кухни нет, поэтому повторяем то, что
// дёргает админка: claim/complete/serve — ПРЯМЫЕ UPDATE kitchen_queue (см.
// apps/admin/features/kitchen/api/kitchen-queue.ts), смена статуса заказа — RPC
// update_order_status (296), как зовёт assembly.vue. Ассертим состояние БД
// service-role клиентом.
//
// ── Почему заказ создаём атомарным RPC, а НЕ через HTTP POST /api/orders ──
// Под тестом здесь КУХНЯ, а не storefront-чекаут. Pickup-путь по HTTP тащит
// три источника флака, не относящиеся к кухне:
//   1) working-hours гард (resolveDelivery для pickup валит 400 «Филиал закрыт»
//      вне 12:00–03:00 Asia/Krasnoyarsk — задокументированный time-of-day флак);
//   2) rate-limit 5/60s на (tenant, IP);
//   3) обязательный валидный телефон.
// Ни одно из этого не покрывает кухню. Поэтому заказ для setup создаём тем же
// атомарным RPC create_order_with_items_atomic (296), что зовёт сторфронт под
// капотом, но напрямую service-role'ом — сразу на нужном «новом» статусе. Кухня
// наполняется отдельным шагом теста (перевод заказа в sourceStatusId). Так как
// заказ не идёт по HTTP, x-real-ip из плана (10.11.0.x) здесь не нужен.
//
// Тенант: demo (retail, kitchen включён). Owner demo@fastio.app (role_id NULL →
// все права) нужен для permission-gated update_order_status (has_permission
// видит auth.uid()). Статусные UUID НЕ хардкодим — тащим из tenants.kitchen_config
// и order_statuses.

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ?? ''

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000002'
const DEMO_BRANCH_ID = 'ca634a0d-3848-4c10-800c-28f9fde25160'
// Маргарита: requires_kitchen=true → skip_kitchen=false, попадает в kitchen_queue.
const MARGARITA_ID = '00000000-0000-0000-0005-000000000001'

// Маркер в orders.comment — чистим по нему даже после крэша посреди теста
// (полная идемпотентность повторного прогона без ручной чистки БД).
const ORDER_MARKER = 'E2E_KITCHEN'

// service-role клиент — setup/assert/cleanup в обход RLS + create_order_with_items_atomic
// (RPC выдан только service_role) + прямые UPDATE kitchen_queue (как admin api).
const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// owner-authed клиент — для update_order_status (gated has_permission('orders.edit')).
let owner: SupabaseClient

// Вытащено из БД в beforeAll — никаких хардкод-UUID статусов.
let initialStatusId: string
let sourceStatusId: string
let cookingStatusId: string
let completedStatusMap: { pickup: string; delivery: string; dine_in: string | null }
let cancelledStatusId: string
let cookId: string

// Чистим заказы текущего файла leaf-first (FK: kitchen_queue → order_items → orders).
async function cleanupKitchenOrders() {
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

// Создать pickup-заказ на «новом» статусе с itemCount позициями Маргариты (qty 1
// каждая → одна kitchen_queue-строка на позицию после populate). Кухня пуста до
// перевода заказа в sourceStatusId — триггер populate висит на UPDATE orders, не
// на INSERT order_items (dine_in-инсёрт-триггер для pickup сразу выходит).
async function seedPickupOrder(itemCount = 1): Promise<string> {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    dish_id: MARGARITA_ID,
    dish_name: 'Маргарита',
    category_name: null,
    price: 0,
    quantity: 1,
    removed_ingredients: [],
    modifiers: [],
    addons: [],
    sort_order: i,
    status: 'confirmed',
  }))

  const { data, error } = await svc.rpc('create_order_with_items_atomic', {
    p_order_payload: {
      tenant_id: DEMO_TENANT_ID,
      delivery_type: 'pickup',
      branch_id: DEMO_BRANCH_ID,
      comment: ORDER_MARKER,
      subtotal: 0,
      total: 0,
      status: initialStatusId,
      payment_type: 'cash',
    },
    p_items_json: items,
    p_free_item_json: null,
  })
  if (error) throw new Error(`seedPickupOrder: ${error.message}`)

  return (data as { id: string }).id
}

test.beforeAll(async () => {
  owner = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signIn, error: signErr } = await owner.auth.signInWithPassword({
    email: fixtures.adminEmail,
    password: fixtures.adminPassword,
  })
  if (signErr) throw new Error(`owner sign-in failed: ${signErr.message}`)
  cookId = signIn.user!.id

  // kitchen_config (sourceStatusId / cookingStatusId / completedStatusMap) — из тенанта.
  const { data: t, error: tErr } = await svc
    .from('tenants')
    .select('kitchen_config')
    .eq('id', DEMO_TENANT_ID)
    .single()
  if (tErr) throw new Error(`kitchen_config fetch failed: ${tErr.message}`)
  const cfg = t!.kitchen_config as {
    sourceStatusId: string
    cookingStatusId: string
    completedStatusMap: { pickup: string; delivery: string; dine_in: string | null }
  }
  sourceStatusId = cfg.sourceStatusId
  cookingStatusId = cfg.cookingStatusId
  completedStatusMap = cfg.completedStatusMap

  // Начальный «новый» статус (как fetchOrderInitialData в storefront) — на нём
  // живёт заказ до перевода на кухню.
  const { data: initSt, error: initErr } = await svc
    .from('order_statuses')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('group_type', 'new')
    .order('position')
    .limit(1)
    .single()
  if (initErr) throw new Error(`initial status fetch failed: ${initErr.message}`)
  initialStatusId = initSt!.id as string

  // Любой cancelled-статус тенанта (для soft-cancel перехода).
  const { data: cancelRows, error: cancelErr } = await svc
    .from('order_statuses')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('group_type', 'cancelled')
    .order('position')
    .limit(1)
  if (cancelErr) throw new Error(`cancelled status fetch failed: ${cancelErr.message}`)
  cancelledStatusId = cancelRows?.[0]?.id as string
  if (!cancelledStatusId) throw new Error('no cancelled status in demo tenant')

  // Стартуем с чистого листа — вдруг прошлый прогон крэшнул с хвостом.
  await cleanupKitchenOrders()
})

test.afterEach(async () => {
  await cleanupKitchenOrders()
})

test.afterAll(async () => {
  await cleanupKitchenOrders()
  await owner?.auth.signOut()
})

// ── 1. populate: заказ → Принят → ровно 1 строка queued ──────────────────────
test('populate: перевод заказа в sourceStatusId кладёт позицию в очередь как queued', async () => {
  const orderId = await seedPickupOrder(1)

  // Очередь пуста, пока заказ не на «кухонном» статусе.
  const { data: before } = await svc.from('kitchen_queue').select('id').eq('order_id', orderId)
  expect(before).toHaveLength(0)

  const { error } = await owner.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: sourceStatusId,
  })
  expect(error, error?.message).toBeNull()

  const { data: rows } = await svc
    .from('kitchen_queue')
    .select('id, status, order_id, dish_name')
    .eq('order_id', orderId)
  expect(rows).toHaveLength(1)
  expect(rows![0].status).toBe('queued')
  expect(rows![0].order_id).toBe(orderId)
  expect(rows![0].dish_name).toBe('Маргарита')
})

// ── 2. claim → in_progress + авто-«Готовится» (триггер 134) ──────────────────
test('claim: строка → in_progress, заказ авто-переходит в cookingStatusId', async () => {
  const orderId = await seedPickupOrder(1)
  await owner.rpc('update_order_status', { p_order_id: orderId, p_new_status: sourceStatusId })

  const { data: queued } = await svc.from('kitchen_queue').select('id').eq('order_id', orderId).single()

  // Повтор admin kitchenQueueApi.claim — прямой UPDATE.
  const { error: claimErr } = await svc
    .from('kitchen_queue')
    .update({ status: 'in_progress', assigned_to: cookId, assigned_at: new Date().toISOString() })
    .eq('id', queued!.id)
  expect(claimErr, claimErr?.message).toBeNull()

  const { data: row } = await svc
    .from('kitchen_queue')
    .select('status, assigned_to')
    .eq('id', queued!.id)
    .single()
  expect(row!.status).toBe('in_progress')
  expect(row!.assigned_to).toBe(cookId)

  // Триггер 134: первая строка заказа ушла из queued → заказ в cookingStatusId.
  const { data: order } = await svc.from('orders').select('status').eq('id', orderId).single()
  expect(order!.status).toBe(cookingStatusId)
})

// ── 3. complete → done ───────────────────────────────────────────────────────
test('complete: строка → done', async () => {
  const orderId = await seedPickupOrder(1)
  await owner.rpc('update_order_status', { p_order_id: orderId, p_new_status: sourceStatusId })

  const { data: queued } = await svc.from('kitchen_queue').select('id').eq('order_id', orderId).single()

  await svc
    .from('kitchen_queue')
    .update({ status: 'in_progress', assigned_to: cookId, assigned_at: new Date().toISOString() })
    .eq('id', queued!.id)

  // Повтор admin kitchenQueueApi.complete.
  const { error: doneErr } = await svc
    .from('kitchen_queue')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', queued!.id)
  expect(doneErr, doneErr?.message).toBeNull()

  const { data: row } = await svc.from('kitchen_queue').select('status').eq('id', queued!.id).single()
  expect(row!.status).toBe('done')
})

// ── 4. сборка («Собрано») → served + заказ → «К выдаче» ──────────────────────
test('assembly: serveAllForOrders + update_order_status → строки served, заказ в completedStatusMap.pickup', async () => {
  const orderId = await seedPickupOrder(1)
  await owner.rpc('update_order_status', { p_order_id: orderId, p_new_status: sourceStatusId })

  const { data: queued } = await svc.from('kitchen_queue').select('id').eq('order_id', orderId).single()
  await svc
    .from('kitchen_queue')
    .update({ status: 'in_progress', assigned_to: cookId, assigned_at: new Date().toISOString() })
    .eq('id', queued!.id)
  await svc
    .from('kitchen_queue')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', queued!.id)

  // Повтор assembly.vue onAssembled (параллельные шаги «Собрано»):
  // serveAllForOrders + orders.kitchen_completed_at + update_order_status.
  const now = new Date().toISOString()
  const { error: serveErr } = await svc
    .from('kitchen_queue')
    .update({ status: 'served', served_at: now, served_by: cookId })
    .in('order_id', [orderId])
    .in('status', ['queued', 'in_progress', 'done'])
  expect(serveErr, serveErr?.message).toBeNull()

  await svc.from('orders').update({ kitchen_completed_at: now }).eq('id', orderId)

  const { error: statusErr } = await owner.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: completedStatusMap.pickup,
  })
  expect(statusErr, statusErr?.message).toBeNull()

  const { data: rows } = await svc.from('kitchen_queue').select('status').eq('order_id', orderId)
  expect(rows!.every((r) => r.status === 'served')).toBe(true)

  const { data: order } = await svc.from('orders').select('status').eq('id', orderId).single()
  expect(order!.status).toBe(completedStatusMap.pickup)
})

// ── 5. отмена в процессе готовки → soft-cancel (P0-регрессия Phase 06, триггер 304) ─
test('soft-cancel: отмена заказа отменяет queued/in_progress/done строки, served не трогает', async () => {
  // Две позиции → две kitchen-строки: одну держим in_progress, вторую served.
  const orderId = await seedPickupOrder(2)
  await owner.rpc('update_order_status', { p_order_id: orderId, p_new_status: sourceStatusId })

  const { data: rows } = await svc
    .from('kitchen_queue')
    .select('id')
    .eq('order_id', orderId)
    .order('created_at')
  expect(rows).toHaveLength(2)
  const [cookingRow, servedRow] = rows!

  // Одну в работу (триггер 134 переведёт заказ в cooking), другую — выдали.
  await svc
    .from('kitchen_queue')
    .update({ status: 'in_progress', assigned_to: cookId, assigned_at: new Date().toISOString() })
    .eq('id', cookingRow.id)
  await svc
    .from('kitchen_queue')
    .update({ status: 'served', served_at: new Date().toISOString(), served_by: cookId })
    .eq('id', servedRow.id)

  // Отмена заказа → триггер kitchen_queue_on_order_cancel (304).
  const { error: cancelErr } = await owner.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: cancelledStatusId,
  })
  expect(cancelErr, cancelErr?.message).toBeNull()

  const { data: cooking } = await svc.from('kitchen_queue').select('status').eq('id', cookingRow.id).single()
  expect(cooking!.status).toBe('cancelled')

  // served — исторический факт «еда отдана», отмена его не касается.
  const { data: served } = await svc.from('kitchen_queue').select('status').eq('id', servedRow.id).single()
  expect(served!.status).toBe('served')
})

// ── 6. идемпотентный populate (миграция 141: stamp kitchen_queued_at) ─────────
test('populate идемпотентен: повторный заход на sourceStatusId не плодит строки', async () => {
  const orderId = await seedPickupOrder(1)

  await owner.rpc('update_order_status', { p_order_id: orderId, p_new_status: sourceStatusId })
  const { data: first } = await svc.from('kitchen_queue').select('id').eq('order_id', orderId)
  expect(first).toHaveLength(1)

  // Раунд-трип source → cooking → source. Триггер на BEFORE UPDATE проверяет
  // kitchen_queued_at и не репопулирует (кухня уже «отстреляла»).
  await owner.rpc('update_order_status', { p_order_id: orderId, p_new_status: cookingStatusId })
  await owner.rpc('update_order_status', { p_order_id: orderId, p_new_status: sourceStatusId })

  const { data: second } = await svc.from('kitchen_queue').select('id').eq('order_id', orderId)
  expect(second).toHaveLength(1)
})

// ── 7. [опц.] комбо → 2 клона ────────────────────────────────────────────────
// TODO: combo-кейс не покрываем — в supabase/seed/e2e-ci.sql комбо «Комбо 1»
// (e896dfdc-377b-4df5-80d0-0646b5e0d815) есть, но НИ ОДНОЙ строки combo_items к
// нему нет (таблица в сиде пуста). Populate такого комбо клонов не создаёт →
// нечего ассертить. Чтобы включить тест — добавить combo_items в сид (≥2 dish с
// requires_kitchen=true) и проверить, что populate даёт 2 строки с combo_id +
// combo_name и без ошибки 22023 (гард миграции 306). UUID комбо НЕ выдумывать.
test.fixme('combo: заказ с комбо → 2 строки-клона с combo_id/combo_name (нужен combo_items в сиде)', async () => {
  // intentionally empty — см. TODO выше
})
