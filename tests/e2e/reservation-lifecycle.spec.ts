import { test, expect, request as pwRequest } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fixtures } from './fixtures'

// E2E lifecycle броней (reservations) — admin-переходы статусов.
//
// Уровень: граница БД/RLS. Admin-UI харнесса для броней нет, поэтому повторяем
// ровно то, что дёргает админка — apps/admin/features/reservations/api/reservations.ts:
// все переходы (confirm/seat/complete/cancel) это ПРЯМОЙ UPDATE reservations, не RPC.
// Создание брони для setup делаем прямым INSERT service-role'ом (в обход RLS,
// без HTTP-слотов), а не через POST /api/reservations — иначе тащим working-hours
// гард (slot validation по расписанию demo 12:00–03:00 Krasnoyarsk) и rate-limit.
// Под тестом тут lifecycle, а не приём заявки → INSERT pending напрямую делает
// файл TIME-НЕЗАВИСИМЫМ (кандидат и в smoke, и в nightly).
//
// ── Под кем делаем UPDATE-переходы ──
// Берём owner (signIn demo@fastio.app, role_id NULL → has_permission('tables.manage')
// проходит), а не svc. Так UPDATE идёт через реальную RLS-политику
// reservations_update_manage — это то, что выполняет админка. svc обошёл бы RLS
// и не проверил бы право. Seed/assert/cleanup — service-role'ом (в обход RLS).
//
// ── Тенант ──
// demo (retail, dineIn включён). CI-сид e2e-ci.sql пуст по reservations/table_settings
// → self-seed + идемпотентный leaf-cleanup по marker'у в guest_name переживает
// повторный прогон.

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ?? ''

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000002'
const DEMO_BRANCH_ID = 'ca634a0d-3848-4c10-800c-28f9fde25160'

const STOREFRONT_BASE = `http://${fixtures.retailTenantSlug}.localhost:4711`

// Маркер в reservations.guest_name — чистим по нему даже после крэша посреди
// прогона (полная идемпотентность повторного запуска без ручной чистки БД).
const RES_MARKER = 'E2E_RES_LIFECYCLE'

// service-role клиент — seed/assert/cleanup в обход RLS.
const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// owner-authed клиент — для UPDATE-переходов через RLS tables.manage.
let owner: SupabaseClient
let ownerId: string

// Любой active demo-стол — для confirm (лукапом, не хардкодим UUID на случай дрейфа сид).
let demoTableId: string
let demoTableName: string

// table_settings — tenant-level (UNIQUE tenant_id). Снимок для negative-гейта.
let tableSettingsExisted = false
let origBookingEnabled = true

// Чистим брони файла по marker'у (leaf: у reservations нет дочерних строк в наших тестах).
async function cleanupReservations() {
  await svc.from('reservations').delete().eq('tenant_id', DEMO_TENANT_ID).eq('guest_name', RES_MARKER)
}

// INSERT pending-брони напрямую (как делает приём заявки, но без HTTP/слотов).
// reserved_date — в будущем, table_id=NULL изначально (его проставит confirm).
async function seedPendingReservation(extra: Record<string, unknown> = {}): Promise<string> {
  const future = new Date()

  future.setDate(future.getDate() + 14)
  const reservedDate = future.toISOString().slice(0, 10)

  const { data, error } = await svc
    .from('reservations')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      branch_id: DEMO_BRANCH_ID,
      guest_name: RES_MARKER,
      guest_phone: '+79990001234',
      guest_count: 2,
      reserved_date: reservedDate,
      reserved_time: '12:00',
      status: 'pending',
      ...extra,
    })
    .select('id')
    .single()
  if (error) throw new Error(`seedPendingReservation: ${error.message}`)

  return data!.id as string
}

// Один POST /api/reservations в своём rate-limit-бакете (свой x-real-ip).
async function postReservation(ip: string, body: Record<string, unknown>) {
  const ctx = await pwRequest.newContext({
    baseURL: STOREFRONT_BASE,
    extraHTTPHeaders: { 'x-real-ip': ip },
  })
  const res = await ctx.post('/api/reservations', { data: body })
  const status = res.status()
  const text = await res.text()

  await ctx.dispose()

  return { status, text }
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
  ownerId = signIn.user!.id

  // Active demo-стол для confirm — лукапом (UUID не хардкодим, сид дрейфует).
  const { data: tbl, error: tblErr } = await svc
    .from('tables')
    .select('id, name')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('branch_id', DEMO_BRANCH_ID)
    .eq('is_active', true)
    .order('name')
    .limit(1)
    .single()
  if (tblErr) throw new Error(`active demo table lookup failed: ${tblErr.message}`)
  demoTableId = tbl!.id as string
  demoTableName = tbl!.name as string

  // Снимок table_settings (tenant-level) для negative-гейта. CI-сид пуст → если
  // строки нет, создаём дефолтную и помним, что её надо удалить в afterAll.
  const { data: ts } = await svc
    .from('table_settings')
    .select('booking_enabled')
    .eq('tenant_id', DEMO_TENANT_ID)
    .maybeSingle()
  if (ts) {
    tableSettingsExisted = true
    origBookingEnabled = ts.booking_enabled as boolean
  } else {
    tableSettingsExisted = false
    const { error: insErr } = await svc.from('table_settings').insert({ tenant_id: DEMO_TENANT_ID })
    if (insErr) throw new Error(`seed table_settings failed: ${insErr.message}`)
    origBookingEnabled = true
  }

  // Стартуем с чистого листа — вдруг прошлый прогон крэшнул с хвостом.
  await cleanupReservations()
})

test.afterEach(async () => {
  await cleanupReservations()
})

test.afterAll(async () => {
  await cleanupReservations()

  // Восстанавливаем table_settings: была строка — возвращаем booking_enabled,
  // создали сами — удаляем (idempotent, чтобы не оставить мусор после CI-прогона).
  if (tableSettingsExisted) {
    await svc.from('table_settings').update({ booking_enabled: origBookingEnabled }).eq('tenant_id', DEMO_TENANT_ID)
  } else {
    await svc.from('table_settings').delete().eq('tenant_id', DEMO_TENANT_ID)
  }

  await owner?.auth.signOut()
})

// ── 1. confirm: pending → confirmed (table_id проставлен) ─────────────────────
test('confirm: pending → confirmed, confirmed_at не null, table_id проставлен', async () => {
  const id = await seedPendingReservation()

  // Повтор admin reservationsApi.confirm — прямой UPDATE через RLS owner'а.
  const { error } = await owner
    .from('reservations')
    .update({
      status: 'confirmed',
      table_id: demoTableId,
      table_name: demoTableName,
      confirmed_by: ownerId,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  expect(error, error?.message).toBeNull()

  const { data: row } = await svc
    .from('reservations')
    .select('status, confirmed_at, confirmed_by, table_id')
    .eq('id', id)
    .single()
  expect(row!.status).toBe('confirmed')
  expect(row!.confirmed_at).not.toBeNull()
  expect(row!.confirmed_by).toBe(ownerId)
  expect(row!.table_id).toBe(demoTableId)
})

// ── 2. seat: confirmed → seated ──────────────────────────────────────────────
test('seat: confirmed → seated, seated_at не null', async () => {
  const id = await seedPendingReservation({ status: 'confirmed' })

  const { error } = await owner
    .from('reservations')
    .update({ status: 'seated', seated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
  expect(error, error?.message).toBeNull()

  const { data: row } = await svc.from('reservations').select('status, seated_at').eq('id', id).single()
  expect(row!.status).toBe('seated')
  expect(row!.seated_at).not.toBeNull()
})

// ── 3. complete: seated → completed ──────────────────────────────────────────
test('complete: seated → completed, completed_at не null', async () => {
  const id = await seedPendingReservation({ status: 'seated', seated_at: new Date().toISOString() })

  const { error } = await owner
    .from('reservations')
    .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
  expect(error, error?.message).toBeNull()

  const { data: row } = await svc.from('reservations').select('status, completed_at').eq('id', id).single()
  expect(row!.status).toBe('completed')
  expect(row!.completed_at).not.toBeNull()
})

// ── 4. cancel: pending → cancelled (reason сохранён) ─────────────────────────
test('cancel: pending → cancelled, cancel_reason сохранён', async () => {
  const id = await seedPendingReservation()
  const reason = 'E2E передумал гость'

  const { error } = await owner
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  expect(error, error?.message).toBeNull()

  const { data: row } = await svc.from('reservations').select('status, cancelled_at, cancel_reason').eq('id', id).single()
  expect(row!.status).toBe('cancelled')
  expect(row!.cancelled_at).not.toBeNull()
  expect(row!.cancel_reason).toBe(reason)
})

// ── 5. booking gate выключен → 400 «Бронирование недоступно» ──────────────────
// table_settings.booking_enabled — server-side тоггл приёма броней. Гейт
// (index.post.ts) проверяется рано, до slot-валидации → time-независимо.
test('booking gate: booking_enabled=false → POST /api/reservations 400 «Бронирование недоступно»', async () => {
  // Сброс rate-limit на reservations: один POST не превысит 5/60s, но чистим для
  // идемпотентности повторного прогона (ключ reservations:tenant-ip:{tid}:{ip}).
  await svc.from('auth_rate_limits').delete().like('key', 'reservations:%')

  await svc.from('table_settings').update({ booking_enabled: false }).eq('tenant_id', DEMO_TENANT_ID)

  const future = new Date()

  future.setDate(future.getDate() + 7)
  const reservedDate = future.toISOString().slice(0, 10)

  // Тело валидно по базовым проверкам (имя/телефон/дата+время/гости), чтобы
  // дойти именно до гейта booking_enabled, а не упасть раньше на валидации.
  const { status, text } = await postReservation('10.14.0.1', {
    guestName: 'E2E gate',
    guestPhone: '+79990001234',
    reservedDate,
    reservedTime: '12:00',
    guestCount: 2,
    branchId: DEMO_BRANCH_ID,
  })

  // Восстанавливаем тоггл сразу (afterAll подстрахует, если тест упадёт раньше).
  await svc.from('table_settings').update({ booking_enabled: origBookingEnabled }).eq('tenant_id', DEMO_TENANT_ID)

  expect(status, text).toBe(400)
  expect(text).toContain('Бронирование недоступно')

  // Бронь не создалась (гейт до insert).
  const { data } = await svc
    .from('reservations')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('guest_name', 'E2E gate')
  expect(data).toHaveLength(0)
})

// ── 6. idempotency: дубль idempotency_key → 23505 (UNIQUE per-tenant) ─────────
// reservations_idempotency_key_per_tenant_idx UNIQUE (tenant_id, idempotency_key)
// WHERE idempotency_key IS NOT NULL — защита от двойного submit (PREPROD-014).
test('idempotency: второй INSERT с тем же idempotency_key падает на 23505', async () => {
  const key = `e2e-res-${Date.now()}`

  const first = await seedPendingReservation({ idempotency_key: key })
  expect(first).toBeTruthy()

  const { error } = await svc.from('reservations').insert({
    tenant_id: DEMO_TENANT_ID,
    branch_id: DEMO_BRANCH_ID,
    guest_name: RES_MARKER,
    guest_phone: '+79990001234',
    guest_count: 2,
    reserved_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    reserved_time: '13:00',
    status: 'pending',
    idempotency_key: key,
  })
  expect(error).not.toBeNull()
  expect(error!.code).toBe('23505')

  // В БД ровно одна бронь с этим ключом.
  const { data } = await svc
    .from('reservations')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('idempotency_key', key)
  expect(data).toHaveLength(1)
})

// ── 7. cron no_show — детерминированно не дёрнуть из E2E ──────────────────────
// TODO: авто-отмена «no_show» висит INLINE SQL в cron.job (миграция 092), вызываемой
// SQL-функции нет → без pg_cron-тика в E2E переход pending→no_show не воспроизвести
// детерминированно. Чтобы включить — вынести логику в named-функцию и звать её
// напрямую service-role'ом, затем ассертить status='no_show'. UUID/SQL не выдумывать.
test.fixme('cron no_show: pending-бронь по прошедшему слоту авто-уходит в no_show', async () => {
  // intentionally empty — см. TODO выше
})
