import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fixtures } from './fixtures'

// E2E полной цепочки статусов заказа + отмена. Граница — RPC update_order_status
// (296), который зовёт админка при смене статуса. Ассертим состояние orders в БД
// service-role клиентом.
//
// ── Почему заказ создаём атомарным RPC, а НЕ через HTTP POST /api/orders ──
// Под тестом ЖИЗНЕННЫЙ ЦИКЛ заказа (переходы статусов), а не storefront-чекаут.
// Pickup-путь по HTTP тащит источники флака, не относящиеся к статусам:
// working-hours гард (time-of-day 400), rate-limit 5/60s, обязательный телефон.
// Поэтому заказ для setup создаём тем же атомарным RPC
// create_order_with_items_atomic (296), что зовёт сторфронт, но напрямую
// service-role'ом — сразу на «новом» статусе. Так как заказ не идёт по HTTP,
// x-real-ip и reset rate-limit здесь не нужны.
//
// ── Permission ──
// update_order_status gated has_permission('orders.edit') → зовём под owner-клиентом
// (demo@fastio.app, role_id NULL → все права), has_permission видит auth.uid().
// Статусные UUID НЕ хардкодим — тащим из order_statuses лукапом по name.

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ?? ''

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000002'
const DEMO_BRANCH_ID = 'ca634a0d-3848-4c10-800c-28f9fde25160'
// Маргарита: base 650, requires_kitchen=true. Здесь кухня не задействуется
// (заказ живёт на «новом» статусе), но блюдо берём существующее в сиде.
const MARGARITA_ID = '00000000-0000-0000-0005-000000000001'

// Маркер в orders.comment — чистим по нему даже после крэша посреди теста
// (полная идемпотентность повторного прогона без ручной чистки БД).
const ORDER_MARKER = 'E2E_LIFECYCLE'

// service-role клиент — setup/assert/cleanup в обход RLS + create_order_with_items_atomic
// (RPC выдан только service_role).
const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// owner-authed клиент — для update_order_status (gated has_permission('orders.edit')).
let owner: SupabaseClient

// Статусы demo по name → id. Заполняется в beforeAll, никаких хардкод-UUID.
const statusByName = new Map<string, string>()

const statusId = (name: string): string => {
  const id = statusByName.get(name)
  if (!id) throw new Error(`status not found in demo tenant: ${name}`)

  return id
}

// Чистим заказы текущего файла leaf-first (FK: kitchen_queue → order_items → orders).
async function cleanupLifecycleOrders() {
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

// Создать pickup-заказ на «Новом» статусе с itemCount позициями Маргариты.
// Заказ остаётся вне кухни — populate-триггер висит на смене статуса orders, а
// мы создаём сразу на «новом» и в кухню не переводим.
async function seedNewOrder(itemCount = 1): Promise<string> {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    dish_id: MARGARITA_ID,
    dish_name: 'Маргарита',
    category_name: null,
    price: 650,
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
      subtotal: 650 * itemCount,
      total: 650 * itemCount,
      status: statusId('Новый'),
      payment_type: 'cash',
    },
    p_items_json: items,
    p_free_item_json: null,
  })
  if (error) throw new Error(`seedNewOrder: ${error.message}`)

  return (data as { id: string }).id
}

test.beforeAll(async () => {
  owner = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signErr } = await owner.auth.signInWithPassword({
    email: fixtures.adminEmail,
    password: fixtures.adminPassword,
  })
  if (signErr) throw new Error(`owner sign-in failed: ${signErr.message}`)

  // Все статусы demo лукапом по name — цепочка переходов строится из них.
  const { data: statuses, error: stErr } = await svc
    .from('order_statuses')
    .select('id, name, group_type')
    .eq('tenant_id', DEMO_TENANT_ID)
  if (stErr) throw new Error(`order_statuses fetch failed: ${stErr.message}`)
  for (const s of statuses ?? []) statusByName.set(s.name as string, s.id as string)

  // Стартуем с чистого листа — вдруг прошлый прогон крэшнул с хвостом.
  await cleanupLifecycleOrders()
})

test.afterEach(async () => {
  await cleanupLifecycleOrders()
})

test.afterAll(async () => {
  await cleanupLifecycleOrders()
  await owner?.auth.signOut()
})

// ── 1. полная цепочка статусов ───────────────────────────────────────────────
test('полная цепочка: Новый → Принят → Готовится → Готов → Доставляется → Выполнен', async () => {
  const orderId = await seedNewOrder(1)

  // Цепочка in_progress + completed. «Новый» — стартовый, его не переходим.
  const chain = ['Принят', 'Готовится', 'Готов', 'Доставляется', 'Выполнен']

  for (const name of chain) {
    const target = statusId(name)
    const { error } = await owner.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: target,
    })
    expect(error, `${name}: ${error?.message}`).toBeNull()

    // orders.status хранится text (uuid-строка) — сверяем с целевым id.
    const { data: order } = await svc.from('orders').select('status').eq('id', orderId).single()
    expect(order!.status, `после перехода в ${name}`).toBe(target)
  }

  // Реальный аудит переходов живёт в orders.visited_statuses (text[]), не в
  // order_events — трекается триггером orders_track_visited_status. Каждый
  // посещённый статус должен попасть в массив (стартовый «Новый» + вся цепочка).
  const { data: final } = await svc
    .from('orders')
    .select('visited_statuses')
    .eq('id', orderId)
    .single()
  const visited = (final!.visited_statuses ?? []) as string[]
  expect(visited).toContain(statusId('Новый'))
  for (const name of chain) expect(visited, `${name} в visited_statuses`).toContain(statusId(name))
})

// ── 2. [fixme] аудит переходов в order_events ────────────────────────────────
// TODO: смена статуса НЕ пишется в order_events. На orders висит только
// order_created_trigger (AFTER INSERT → log_order_created, event_type='created').
// update_order_status (296) в order_events не пишет вообще, status-change-триггера
// на orders нет. Фактический аудит переходов — orders.visited_statuses (text[]),
// проверяется в тесте 1. Чтобы включить этот тест — добавить в update_order_status
// (или отдельный AFTER UPDATE триггер на orders) INSERT в order_events с
// event_type='status_changed' и meta={from,to}, затем ассертить запись здесь.
// Не выдумываем формат события, которого нет.
test.fixme('аудит: смена статуса пишет событие в order_events', async () => {
  // intentionally empty — см. TODO выше
})

// ── 3. отмена из in_progress ─────────────────────────────────────────────────
test('отмена: Новый → Принят → Отменён (group cancelled)', async () => {
  const orderId = await seedNewOrder(1)

  await owner.rpc('update_order_status', { p_order_id: orderId, p_new_status: statusId('Принят') })

  const { error } = await owner.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: statusId('Отменён'),
  })
  expect(error, error?.message).toBeNull()

  const { data: order } = await svc.from('orders').select('status').eq('id', orderId).single()
  expect(order!.status).toBe(statusId('Отменён'))
})

// ── 4. отмена с позициями не теряет заказ ────────────────────────────────────
test('отмена с 2 позициями: заказ и items на месте, статус cancelled', async () => {
  const orderId = await seedNewOrder(2)

  // Позиции лежат до отмены (заказ не на кухне → kitchen-триггеры не трогают items).
  const { data: before } = await svc.from('order_items').select('id').eq('order_id', orderId)
  expect(before).toHaveLength(2)

  const { error } = await owner.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: statusId('Отменён'),
  })
  expect(error, error?.message).toBeNull()

  // Заказ существует, статус cancelled.
  const { data: order } = await svc.from('orders').select('status').eq('id', orderId).single()
  expect(order, 'заказ не должен исчезнуть при отмене').not.toBeNull()
  expect(order!.status).toBe(statusId('Отменён'))

  // Позиции не удалены — отмена на уровне заказа их не сносит (kitchen soft-cancel
  // покрыт отдельно в kitchen-flow; здесь заказ кухню вообще не проходил).
  const { data: after } = await svc.from('order_items').select('id').eq('order_id', orderId)
  expect(after).toHaveLength(2)
})

// ── 5. терминальность: переход из терминального статуса ───────────────────────
// Фиксируем ФАКТИЧЕСКОЕ поведение: update_order_status (296) терминальность НЕ
// сторожит — нет гарда на переход из completed/cancelled. Любой переход на статус
// того же тенанта разрешён (единственные проверки — orders.edit + cross-tenant).
// Этот тест — регрессионный замок на «откат разрешён», а не выдумка.
test('терминальность не enforced: из Выполнен можно вернуть в Принят', async () => {
  const orderId = await seedNewOrder(1)

  await owner.rpc('update_order_status', { p_order_id: orderId, p_new_status: statusId('Выполнен') })

  // Откат из терминального completed обратно в in_progress — RPC не блокирует.
  const { error } = await owner.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: statusId('Принят'),
  })
  expect(error, `откат из Выполнен должен пройти (нет terminal-гарда): ${error?.message}`).toBeNull()

  const { data: order } = await svc.from('orders').select('status').eq('id', orderId).single()
  expect(order!.status).toBe(statusId('Принят'))
})
