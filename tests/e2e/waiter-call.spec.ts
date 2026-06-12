import { test, expect, request as pwRequest } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fixtures } from './fixtures'

// Task — E2E «вызов официанта»: витрина → БД → admin resolve + все серверные гарды.
//
// Уровень: реальный HTTP `POST /api/table/[id]/call` на storefront demo-тенанта —
// вся логика гардов (IDOR-cookie, waiter_call_enabled, cooldown, is_active/is_open)
// живёт в серверном эндпоинте, дёрнуть её можно только через него. Ассертим итог
// в БД service-role клиентом; admin resolve имитируем прямым UPDATE table_calls
// (так же как admin api features/tables/api/table-calls.ts → resolve()).
//
// Тенант: demo (retail). Стол: выделенный E2E-стол с фикс. UUID, пересоздаётся
// перед каждым тестом в нужном is_active/is_open, чистится в afterAll — чтобы не
// цеплять ручные тестовые столы. UUID-формат стола ВАЖЕН: эндпоинт валидирует
// router-param регэкспом v1-5 (третья группа 1-5, четвёртая 8-b) → берём канонично
// валидный, отличный от dinein-стола.
//
// table_settings — tenant-level (UNIQUE tenant_id). waiter_call_enabled нужен true
// для positive-тестов; snapshot оригинала в beforeAll, временный false для теста 7,
// полный restore в afterAll.

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ?? ''

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000002'
const DEMO_BRANCH_ID = 'ca634a0d-3848-4c10-800c-28f9fde25160'

// Выделенный E2E-стол. Канонично валидный uuid (v4-форма) — обязан проходить
// UUID_RE эндпоинта; намеренно ДРУГОЙ, чем dinein-стол (не пересекаемся).
const E2E_TABLE_ID = 'e2ca110e-0000-4000-8000-000000000001'
const E2E_TABLE_NAME = 'E2E waiter-call стол'
// Чужой стол для IDOR-теста — тоже валидный формат, в БД его нет.
const OTHER_TABLE_ID = 'e2ca110e-0000-4000-8000-0000000000ff'

const DEFAULT_CALL_TYPE_NAME = 'Вызвать официанта'
const DEFAULT_COOLDOWN = 30 // table_settings.call_cooldown_seconds DEFAULT 30

const STOREFRONT_BASE = `http://${fixtures.retailTenantSlug}.localhost:4711`

// service-role клиент — seed/assert/cleanup в обход RLS.
const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Снимок исходной table_settings-строки demo (или её отсутствия) для restore.
let settingsSnapshot: Record<string, unknown> | null = null
let settingsExisted = false

// Полная очистка состояния E2E-стола: его вызовы (leaf), затем сам стол.
async function resetTable() {
  await svc.from('table_calls').delete().eq('table_id', E2E_TABLE_ID)
  await svc.from('tables').delete().eq('id', E2E_TABLE_ID)
}

// Пересоздать стол в нужном is_active/is_open. Стол всегда привязан к филиалу (D-11).
async function seedTable(isActive: boolean, isOpen: boolean) {
  await resetTable()
  const { error } = await svc.from('tables').insert({
    id: E2E_TABLE_ID,
    tenant_id: DEMO_TENANT_ID,
    branch_id: DEMO_BRANCH_ID,
    name: E2E_TABLE_NAME,
    is_active: isActive,
    is_open: isOpen,
    opened_at: isOpen ? new Date().toISOString() : null,
  })
  if (error) throw new Error(`seedTable failed: ${error.message}`)
}

// Переключить tenant-level toggle вызова официанта (мутирует общую строку demo).
async function setWaiterCallEnabled(enabled: boolean) {
  const { error } = await svc
    .from('table_settings')
    .upsert({ tenant_id: DEMO_TENANT_ID, waiter_call_enabled: enabled }, { onConflict: 'tenant_id' })
  if (error) throw new Error(`setWaiterCallEnabled failed: ${error.message}`)
}

// Один POST /api/table/[id]/call в своём rate-limit-бакете (свой x-real-ip).
// cookie — опциональна (для IDOR-тестов её опускаем / подменяем чужой).
async function callTable(ip: string, opts: { cookieTableId?: string; body?: Record<string, unknown> } = {}) {
  const headers: Record<string, string> = { 'x-real-ip': ip }
  if (opts.cookieTableId !== undefined) headers.cookie = `fastio_table=${opts.cookieTableId}`

  const ctx = await pwRequest.newContext({ baseURL: STOREFRONT_BASE, extraHTTPHeaders: headers })
  const res = await ctx.post(`/api/table/${E2E_TABLE_ID}/call`, { data: opts.body ?? {} })
  const status = res.status()
  const text = await res.text()
  await ctx.dispose()

  return { status, text }
}

test.beforeAll(async () => {
  // Snapshot tenant-level table_settings — мутации waiter_call_enabled обратимы.
  const { data } = await svc
    .from('table_settings')
    .select('*')
    .eq('tenant_id', DEMO_TENANT_ID)
    .maybeSingle()
  settingsSnapshot = data ?? null
  settingsExisted = data !== null

  // Positive-тестам нужен включённый вызов официанта — засеваем явно.
  await setWaiterCallEnabled(true)
})

test.afterAll(async () => {
  await resetTable()
  // Restore: была строка → вернуть исходный toggle; не было → удалить нашу.
  if (settingsExisted && settingsSnapshot) {
    await svc
      .from('table_settings')
      .update({ waiter_call_enabled: settingsSnapshot.waiter_call_enabled })
      .eq('tenant_id', DEMO_TENANT_ID)
  } else {
    await svc.from('table_settings').delete().eq('tenant_id', DEMO_TENANT_ID)
  }
})

test.beforeEach(async () => {
  // Cooldown-ключ table-call:{id} per-table (НЕ per-IP) → копится между тестами.
  // Сброс перед каждым тестом изолирует все, КРОМЕ теста 8, который сам хочет 429
  // и поэтому не чистит лимит между своими двумя POST.
  await svc.from('auth_rate_limits').delete().like('key', 'table-call:%')
})

// ── 1. Создать вызов: cookie совпадает, стол открыт+активен → 200 + строка ────
test('создать вызов: 200, верная форма ответа, в table_calls pending-строка', async () => {
  await seedTable(true, true)

  const { status, text } = await callTable('10.15.0.1', { cookieTableId: E2E_TABLE_ID })
  expect(status, text).toBe(200)

  const payload = JSON.parse(text)
  // Форма ответа: { call: { id, created_at, call_type_name }, cooldownSeconds }.
  expect(payload.call?.id).toBeTruthy()
  expect(payload.call?.created_at).toBeTruthy()
  expect(payload.call?.call_type_name).toBe(DEFAULT_CALL_TYPE_NAME)
  expect(payload.cooldownSeconds).toBe(DEFAULT_COOLDOWN)

  // В БД ровно одна pending-строка (resolved_at NULL) на наш стол.
  const { data: calls } = await svc
    .from('table_calls')
    .select('id, table_id, tenant_id, resolved_at, call_type_name')
    .eq('table_id', E2E_TABLE_ID)
  expect(calls).toHaveLength(1)
  expect(calls![0].id).toBe(payload.call.id)
  expect(calls![0].tenant_id).toBe(DEMO_TENANT_ID)
  expect(calls![0].resolved_at).toBeNull()
})

// ── 2. Admin resolve: UPDATE resolved_at=now() → строка перестаёт быть pending ─
test('admin resolve: UPDATE resolved_at=now() → строка resolved', async () => {
  await seedTable(true, true)

  const { status } = await callTable('10.15.0.2', { cookieTableId: E2E_TABLE_ID })
  expect(status).toBe(200)

  const { data: pending } = await svc
    .from('table_calls')
    .select('id')
    .eq('table_id', E2E_TABLE_ID)
    .is('resolved_at', null)
    .single()

  // Admin api features/tables/api/table-calls.ts → resolve(): прямой UPDATE.
  const { error } = await svc
    .from('table_calls')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', pending!.id)
  expect(error, error?.message).toBeNull()

  const { data: resolved } = await svc
    .from('table_calls')
    .select('resolved_at')
    .eq('id', pending!.id)
    .single()
  expect(resolved!.resolved_at).not.toBeNull()
})

// ── 3. IDOR без cookie → 403, вызов не создан ────────────────────────────────
test('IDOR без cookie fastio_table → 403, ничего не создано', async () => {
  await seedTable(true, true)

  const { status, text } = await callTable('10.15.0.3') // cookie не шлём
  expect(status, text).toBe(403)

  const { data: calls } = await svc.from('table_calls').select('id').eq('table_id', E2E_TABLE_ID)
  expect(calls).toHaveLength(0)
})

// ── 4. IDOR чужая cookie → 403 ───────────────────────────────────────────────
test('IDOR чужая cookie (другой стол) → 403, ничего не создано', async () => {
  await seedTable(true, true)

  const { status, text } = await callTable('10.15.0.4', { cookieTableId: OTHER_TABLE_ID })
  expect(status, text).toBe(403)

  const { data: calls } = await svc.from('table_calls').select('id').eq('table_id', E2E_TABLE_ID)
  expect(calls).toHaveLength(0)
})

// ── 5. Закрытый стол (is_open=false) → 400 ───────────────────────────────────
test('закрытый стол → 400 «Стол сейчас не обслуживается»', async () => {
  await seedTable(true, false) // активен, но закрыт

  const { status, text } = await callTable('10.15.0.5', { cookieTableId: E2E_TABLE_ID })
  expect(status, text).toBe(400)

  const { data: calls } = await svc.from('table_calls').select('id').eq('table_id', E2E_TABLE_ID)
  expect(calls).toHaveLength(0)
})

// ── 6. Неактивный стол (is_active=false) → 404 ───────────────────────────────
test('неактивный стол → 404 «Стол не найден»', async () => {
  await seedTable(false, false) // !is_active → 404 раньше чем !is_open

  const { status, text } = await callTable('10.15.0.6', { cookieTableId: E2E_TABLE_ID })
  expect(status, text).toBe(404)

  const { data: calls } = await svc.from('table_calls').select('id').eq('table_id', E2E_TABLE_ID)
  expect(calls).toHaveLength(0)
})

// ── 7. waiter_call_enabled=false → 403 (раньше cooldown и проверки стола) ─────
test('waiter_call выключен на тенанте → 403, ничего не создано', async () => {
  await seedTable(true, true)
  await setWaiterCallEnabled(false)
  try {
    const { status, text } = await callTable('10.15.0.7', { cookieTableId: E2E_TABLE_ID })
    expect(status, text).toBe(403)

    const { data: calls } = await svc.from('table_calls').select('id').eq('table_id', E2E_TABLE_ID)
    expect(calls).toHaveLength(0)
  } finally {
    // Вернуть true для остальных тестов (мутация общей tenant-строки).
    await setWaiterCallEnabled(true)
  }
})

// ── 8. Cooldown: два POST подряд без сброса лимита → второй 429 с retryAfter ──
test('cooldown: второй вызов подряд → 429 с retryAfter', async () => {
  await seedTable(true, true)

  // Первый POST проходит (ключ table-call:{id} только что очищен в beforeEach).
  const first = await callTable('10.15.0.8', { cookieTableId: E2E_TABLE_ID })
  expect(first.status, first.text).toBe(200)

  // Второй БЕЗ сброса rate-limit → consume_rate_limit вернёт false → 429.
  const second = await callTable('10.15.0.8', { cookieTableId: E2E_TABLE_ID })
  expect(second.status, second.text).toBe(429)

  const payload = JSON.parse(second.text)
  // Эндпоинт кладёт retryAfter в data → h3 сериализует в body.data.retryAfter.
  expect(payload.data?.retryAfter ?? payload.retryAfter).toBe(DEFAULT_COOLDOWN)

  // Создан ровно один вызов (второй отбит лимитом до INSERT).
  const { data: calls } = await svc.from('table_calls').select('id').eq('table_id', E2E_TABLE_ID)
  expect(calls).toHaveLength(1)
})
