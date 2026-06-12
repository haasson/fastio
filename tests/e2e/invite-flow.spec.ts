import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fixtures } from './fixtures'

// E2E invite/RBAC флоу — регресс-гард на ТРИ стэкнутых P0, которые жили в приёме
// приглашения и ни один не был покрыт автотестом (каждый стрелял на проде):
//   #1 get-invite дёргал auth.users через REST (PGRST106 на self-hosted) → 500;
//      фикс — лукап через RPC get_user_id_by_email (миграция 169). Тест 2/3.
//   #2 accept-invite выбирал Mode A/B по наличию Authorization-хедера, а
//      supabase-js всегда шлёт `Bearer <anon>` → new-user уходил в auth-mode →
//      ложный 401; фикс — режим по наличию password/fullName. Тест 1.
//   #3 accept_invitation_atomic падал 42883 (uuid = text) на `WHERE token=_token`,
//      т.к. колонка token имеет тип uuid; фикс — каст `_token::uuid` (миграция 332).
//      Тест 1 (любой реальный accept проходит через RPC).
//
// Admin-UI харнесса для команды/инвайтов нет → тестируем границу edge+RPC+БД,
// ровно ту, где жили баги. Тенант: demo (retail). Owner demo@fastio.app
// (role_id NULL → все права) — пароль ресетит setup.mjs.
//
// Edge-функции зовём через `pwRequest` напрямую на /functions/v1/<fn>, а НЕ через
// supabase-js `.functions.invoke`: тесты 4–7 ассертят HTTP-коды (404/409/410), а
// invoke прячет их в FunctionsHttpError и заставляет лезть в ctx.response. Сырой
// HTTP даёт статус и тело в лоб. apikey/Authorization=anon нужны для Kong-gateway;
// accept-invite verify_jwt=false, режим Mode B (new-user) разруливается по body.

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ?? ''

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000002'

// Выделенный e2e-email для new-user accept. Создаёт реальный auth.users —
// чистится в beforeEach И afterAll (иначе UNIQUE(tenant_id,email) на инвайтах и
// UNIQUE(tenant_id,user_id) на members валят повторный прогон).
const TEST_EMAIL = 'e2e-invite@fastio.test'
const NEW_USER_PASSWORD = 'Seed-Test-2026!'
const NEW_USER_NAME = 'E2E Сотрудник'

// service-role клиент — setup/assert/cleanup в обход RLS + auth.admin.* для юзеров.
const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// owner-authed клиент — нужен только чтобы вытащить owner.id для invited_by.
let owner: SupabaseClient
let ownerId: string
// role_id роли «Сотрудник» demo-тенанта — тащим лукапом, не хардкодим.
let staffRoleId: string
// HTTP-контекст к edge-функциям: apikey/Authorization для Kong, baseURL = supabase.
let edge: APIRequestContext

// Удалить auth-юзера TEST_EMAIL + его membership, и тестовые инвайты по обоим
// e2e-email'ам (TEST_EMAIL для new-user, adminEmail для теста «существующий юзер»).
// Юзера adminEmail НЕ трогаем — это реальный demo owner.
async function cleanup() {
  const { data } = await svc.auth.admin.listUsers()
  const u = data.users.find((x) => x.email === TEST_EMAIL)
  if (u) {
    await svc.from('tenant_members').delete().eq('user_id', u.id)
    await svc.auth.admin.deleteUser(u.id)
  }
  await svc.from('tenant_invitations').delete().in('email', [TEST_EMAIL, fixtures.adminEmail])
}

// Создать приглашение в demo-тенант под ролью «Сотрудник». Идемпотентно: сносит
// прежний инвайт на тот же email до вставки (UNIQUE(tenant_id,email)).
// Возвращает token (тип uuid → строка из PostgREST).
async function seedInvite(
  opts: { expiresInDays?: number; acceptedAt?: string | null; email?: string } = {},
): Promise<string> {
  const email = opts.email ?? TEST_EMAIL

  await svc.from('tenant_invitations').delete().eq('tenant_id', DEMO_TENANT_ID).eq('email', email)

  const { data, error } = await svc
    .from('tenant_invitations')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      email,
      role_id: staffRoleId,
      invited_by: ownerId,
      expires_at: new Date(Date.now() + (opts.expiresInDays ?? 7) * 864e5).toISOString(),
      accepted_at: opts.acceptedAt ?? null,
    })
    .select('token')
    .single()
  if (error) throw new Error(`seedInvite: ${error.message}`)

  return data!.token as string
}

// POST /functions/v1/get-invite. ip → свой rate-limit-бакет (30/60s на IP).
async function getInvite(token: string, ip: string) {
  return edge.post('/functions/v1/get-invite', {
    headers: { 'x-real-ip': ip },
    data: { token },
  })
}

// POST /functions/v1/accept-invite. body c password+fullName → Mode B (new-user).
async function acceptInvite(body: Record<string, unknown>, ip: string) {
  return edge.post('/functions/v1/accept-invite', {
    headers: { 'x-real-ip': ip },
    data: body,
  })
}

test.beforeAll(async () => {
  owner = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInErr } = await owner.auth.signInWithPassword({
    email: fixtures.adminEmail,
    password: fixtures.adminPassword,
  })
  if (signInErr) throw new Error(`owner sign-in failed: ${signInErr.message}`)
  ownerId = (await owner.auth.getUser()).data.user!.id

  const { data: role, error: roleErr } = await svc
    .from('tenant_roles')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('name', 'Сотрудник')
    .single()
  if (roleErr || !role) throw new Error(`staff role lookup failed: ${roleErr?.message}`)
  staffRoleId = role.id as string

  edge = await pwRequest.newContext({
    baseURL: SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  })

  // Прогрев изолятов edge-функций: в CI (свежий supabase start) первый запрос к
  // функции компилирует её ~секунды. Без прогрева первый ТЕСТ мог бы словить
  // cold-compile у границы таймаута. Фейк-токен → 404 до всякой записи, результат
  // игнорим — цель только скомпилировать обе функции. Отдельный ip-бакет (.0).
  const warmToken = '00000000-0000-0000-0000-0000000000ff'
  await getInvite(warmToken, '10.12.0.0').catch(() => {})
  await acceptInvite({ token: warmToken, password: NEW_USER_PASSWORD, fullName: NEW_USER_NAME }, '10.12.0.0').catch(() => {})
})

test.beforeEach(cleanup)

test.afterAll(async () => {
  await cleanup()
  await edge?.dispose()
  await owner?.auth.signOut()
})

// ── 1. new-user accept (happy) — покрывает баги #2 (режим) и #3 (uuid-каст) ────
test('accept-invite new-user: создаёт юзера, membership, проставляет accepted_at', async () => {
  const token = await seedInvite()

  const res = await acceptInvite(
    { token, password: NEW_USER_PASSWORD, fullName: NEW_USER_NAME },
    '10.12.0.1',
  )
  expect(res.status(), await res.text()).toBe(200)
  const payload = await res.json()
  expect(payload.success).toBe(true)
  expect(payload.tenantId).toBe(DEMO_TENANT_ID)
  expect(payload.roleId).toBe(staffRoleId)

  // Реальный auth.users создан под TEST_EMAIL.
  const { data: usersData } = await svc.auth.admin.listUsers()
  const created = usersData.users.find((u) => u.email === TEST_EMAIL)
  expect(created, 'auth-юзер TEST_EMAIL должен быть создан').toBeTruthy()

  // tenant_members: роль «Сотрудник», demo-тенант.
  const { data: member } = await svc
    .from('tenant_members')
    .select('role_id, tenant_id')
    .eq('user_id', created!.id)
    .eq('tenant_id', DEMO_TENANT_ID)
    .single()
  expect(member!.role_id).toBe(staffRoleId)

  // Инвайт помечен принятым.
  const { data: inv } = await svc
    .from('tenant_invitations')
    .select('accepted_at')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('email', TEST_EMAIL)
    .single()
  expect(inv!.accepted_at).not.toBeNull()
})

// ── 2. get-invite детали (new-user) — покрывает баг #1 (REST→RPC user lookup) ──
test('get-invite: отдаёт email/roleName/userExists=false для несуществующего юзера', async () => {
  const token = await seedInvite()

  const res = await getInvite(token, '10.12.0.2')
  expect(res.status(), await res.text()).toBe(200)
  const payload = await res.json()
  expect(payload.success).toBe(true)
  expect(payload.email).toBe(TEST_EMAIL)
  expect(payload.roleName).toBe('Сотрудник')
  expect(payload.userExists).toBe(false)
})

// ── 3. get-invite, существующий юзер → userExists=true ───────────────────────
test('get-invite: userExists=true когда email принадлежит существующему юзеру', async () => {
  const token = await seedInvite({ email: fixtures.adminEmail })

  const res = await getInvite(token, '10.12.0.3')
  expect(res.status(), await res.text()).toBe(200)
  const payload = await res.json()
  expect(payload.email).toBe(fixtures.adminEmail)
  expect(payload.userExists).toBe(true)
})

// ── 4. expired → 410 на обоих эндпоинтах ─────────────────────────────────────
test('expired invite: get-invite и accept-invite → 410', async () => {
  const token = await seedInvite({ expiresInDays: -1 })

  const getRes = await getInvite(token, '10.12.0.4')
  expect(getRes.status()).toBe(410)
  expect((await getRes.json()).code).toBe('expired')

  // accept-invite валидирует expiry ДО createUser → 410, orphan-юзер не плодится.
  const accRes = await acceptInvite(
    { token, password: NEW_USER_PASSWORD, fullName: NEW_USER_NAME },
    '10.12.0.4',
  )
  expect(accRes.status(), await accRes.text()).toBe(410)
})

// ── 5. already accepted → 409 на обоих эндпоинтах ────────────────────────────
test('accepted invite: get-invite и accept-invite → 409', async () => {
  const token = await seedInvite({ acceptedAt: new Date().toISOString() })

  const getRes = await getInvite(token, '10.12.0.5')
  expect(getRes.status()).toBe(409)
  expect((await getRes.json()).code).toBe('already_accepted')

  const accRes = await acceptInvite(
    { token, password: NEW_USER_PASSWORD, fullName: NEW_USER_NAME },
    '10.12.0.5',
  )
  expect(accRes.status(), await accRes.text()).toBe(409)
})

// ── 6. not found (случайный токен) → 404 на обоих эндпоинтах ─────────────────
test('unknown token: get-invite и accept-invite → 404', async () => {
  const token = crypto.randomUUID()

  const getRes = await getInvite(token, '10.12.0.6')
  expect(getRes.status()).toBe(404)
  expect((await getRes.json()).code).toBe('not_found')

  const accRes = await acceptInvite(
    { token, password: NEW_USER_PASSWORD, fullName: NEW_USER_NAME },
    '10.12.0.6',
  )
  expect(accRes.status(), await accRes.text()).toBe(404)
})

// ── 7. double-accept: второй раз → 409 (accepted_at уже проставлен) ──────────
test('accept-invite дважды подряд: второй раз → 409', async () => {
  const token = await seedInvite()

  const first = await acceptInvite(
    { token, password: NEW_USER_PASSWORD, fullName: NEW_USER_NAME },
    '10.12.0.7',
  )
  expect(first.status(), await first.text()).toBe(200)

  // Второй accept ловит accepted_at в Step 1 (до createUser) → 409.
  const second = await acceptInvite(
    { token, password: NEW_USER_PASSWORD, fullName: NEW_USER_NAME },
    '10.12.0.7',
  )
  expect(second.status(), await second.text()).toBe(409)
})

// ── 8. authenticated Mode A ───────────────────────────────────────────────────
// TODO: нужен второй retail-тенант, в который demo-owner НЕ входит членом, чтобы
// принять invite залогиненной сессией (Mode A: POST {token} + Bearer <jwt>).
// В e2e-сиде такого «чистого» тенанта нет — demo-owner уже member везде, где есть
// роль «Сотрудник» → accept_invitation_atomic упрётся в UNIQUE(tenant_id,user_id)
// (23505 → 409), и тест проверял бы не тот путь. New-user mode (тест 1) — ровно
// тот режим, что стрелял всеми тремя P0, и он покрыт. Mode A добавить, когда в
// сиде появится изолированный второй тенант без demo-owner в members.
test.fixme('accept-invite authenticated Mode A: owner принимает invite в чужой тенант', async () => {
  // см. TODO выше — требует второго retail-тенанта в сиде.
})
