import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fixtures } from './fixtures'

// E2E lifecycle записей (appointments) тенанта services-start.
//
// Под тестом — граница БД: создание записи через атомарный RPC
// create_appointments_bulk (миграция 218) и конфликт слотов (double-booking)
// на ресурсе с capacity=1. Admin-переходы (confirm/cancel/markDone) — это
// прямые UPDATE appointments (см. apps/admin/features/appointments/api/appointments.ts),
// повторяем их на SQL-уровне. Ассертим состояние БД service-role клиентом.
//
// ── Почему создаём через RPC, а НЕ через HTTP-слоты storefront ──
// HTTP-путь записи тащит working-hours/слот-гард (зависит от времени суток) и
// rate-limit — флак, не относящийся к lifecycle. RPC даёт детерминированную,
// time-независимую запись на ЯВНУЮ будущую дату → годится и в smoke, и в nightly.
//
// ── Почему admin-переходы под svc, а не под owner ──
// Owner из fixtures (demo@fastio.app) — член demo-RETAIL тенанта, а записи живут
// в SERVICES-тенанте. На services-тенант у него нет appointments.manage → RLS
// заблокировала бы UPDATE. svc обходит RLS и делает ровно тот SQL, что и admin
// api. owner поднимаем лишь чтобы получить валидный auth.users uuid для
// confirmed_by (FK appointments.confirmed_by → auth.users).
//
// ⚠️ Дата старта — фикс. now+14d (вне unavailability Анны 2026-05-15..31),
// круглый час; ends = starts + duration услуги.

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ?? ''

const SERVICES_TENANT_ID = 'b1000000-0000-0000-0000-000000000005'
const SERVICES_BRANCH_ID = '4ca87a04-6735-4b6d-a0ae-921c5e5569db'

// Маркер в customer_name — и appointments, и appointment_groups (RPC проставляет
// p_customer_name в группу) → чистим обе таблицы по нему, идемпотентно.
const MARKER = 'E2E_APPT'

// service-role: создание RPC (grant только service_role/authenticated), assert,
// cleanup в обход RLS + admin-UPDATE (см. шапку — почему не owner).
const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// owner — только ради валидного auth.users uuid под confirmed_by.
let owner: SupabaseClient
let ownerUserId: string

// Вытащено из БД лукапом по name (не хардкод UUID — на случай дрейфа сида).
let serviceId: string
let serviceName: string
let servicePrice: number
let serviceDuration: number
let resourceId: string

// Слоты считаем в beforeAll от serviceDuration.
let slotStart: string
let slotEnd: string
let slot2Start: string
let slot2End: string

// Чистим записи текущего файла leaf-first: appointments (FK group_id ON DELETE
// RESTRICT) → appointment_groups. Идемпотентно для повторного прогона.
async function cleanupAppointments() {
  await svc.from('appointments').delete().eq('tenant_id', SERVICES_TENANT_ID).eq('customer_name', MARKER)
  await svc.from('appointment_groups').delete().eq('tenant_id', SERVICES_TENANT_ID).eq('customer_name', MARKER)
}

// Создать запись через RPC. resource/service — выбранные эталоны. Возвращаем
// «сырой» ответ supabase-js, чтобы тест конфликта ассертил error.
async function createAppt(startsAt: string, endsAt: string) {
  return svc.rpc('create_appointments_bulk', {
    p_tenant_id: SERVICES_TENANT_ID,
    p_branch_id: SERVICES_BRANCH_ID,
    p_user_id: null,
    p_customer_id: null,
    p_customer_name: MARKER,
    p_customer_phone: '+70000000000',
    p_customer_email: null,
    p_status: 'new',
    p_notes: null,
    p_allow_reschedule_snapshot: false,
    p_allow_cancel_snapshot: false,
    p_source: 'admin',
    p_items: [
      {
        service_id: serviceId,
        resource_id: resourceId,
        starts_at: startsAt,
        ends_at: endsAt,
        service_name: serviceName,
        service_price: servicePrice,
      },
    ],
  })
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
  ownerUserId = signIn.user!.id

  // Лукап услуги «Стрижка обычная» (60 мин) — id/price/duration из сида.
  const { data: svcRow, error: svcErr } = await svc
    .from('services')
    .select('id, name, price, duration')
    .eq('tenant_id', SERVICES_TENANT_ID)
    .ilike('name', '%Стрижка обычная%')
    .single()
  if (svcErr) throw new Error(`service lookup failed: ${svcErr.message}`)
  serviceId = svcRow!.id as string
  serviceName = svcRow!.name as string
  servicePrice = Number(svcRow!.price)
  serviceDuration = Number(svcRow!.duration)

  // Лукап ресурса «Анна Петрова» (capacity=1) — для конфликта слота.
  const { data: resRow, error: resErr } = await svc
    .from('resources')
    .select('id, capacity')
    .eq('tenant_id', SERVICES_TENANT_ID)
    .ilike('name', '%Анна Петрова%')
    .single()
  if (resErr) throw new Error(`resource lookup failed: ${resErr.message}`)
  resourceId = resRow!.id as string
  // Конфликт-кейс верен только при capacity=1 — иначе overlap не упрётся.
  expect(Number(resRow!.capacity), 'resource capacity должно быть 1').toBe(1)

  // Будущий слот вне окна недоступности Анны (now+14d), круглый час UTC.
  const base = new Date()
  base.setUTCDate(base.getUTCDate() + 14)
  base.setUTCHours(7, 0, 0, 0)
  const durMs = serviceDuration * 60 * 1000
  slotStart = base.toISOString()
  slotEnd = new Date(base.getTime() + durMs).toISOString()
  // +2 часа — заведомо не пересекается с 60-минутным слотом.
  slot2Start = new Date(base.getTime() + 2 * 60 * 60 * 1000).toISOString()
  slot2End = new Date(base.getTime() + 2 * 60 * 60 * 1000 + durMs).toISOString()

  await cleanupAppointments()
})

test.afterEach(async () => {
  await cleanupAppointments()
})

test.afterAll(async () => {
  await cleanupAppointments()
  await owner?.auth.signOut()
})

// ── 1. создание через RPC ────────────────────────────────────────────────────
test('create_appointments_bulk: вернул group_id + 1 appointment, в БД status=new', async () => {
  const { data, error } = await createAppt(slotStart, slotEnd)
  expect(error, error?.message).toBeNull()

  const res = data as { group_id: string; appointments: Array<{ id: string }> }
  expect(res.group_id).toBeTruthy()
  expect(res.appointments).toHaveLength(1)

  const apptId = res.appointments[0].id
  const { data: row } = await svc
    .from('appointments')
    .select('status, service_id, resource_id, starts_at, group_id')
    .eq('id', apptId)
    .single()
  expect(row!.status).toBe('new')
  expect(row!.service_id).toBe(serviceId)
  expect(row!.resource_id).toBe(resourceId)
  expect(new Date(row!.starts_at as string).toISOString()).toBe(slotStart)
  expect(row!.group_id).toBe(res.group_id)
})

// ── 2. конфликт слота (double-booking, capacity=1) ───────────────────────────
test('create_appointments_bulk: повтор на тот же ресурс/слот → Slot is taken (P0002)', async () => {
  const { error: firstErr } = await createAppt(slotStart, slotEnd)
  expect(firstErr, firstErr?.message).toBeNull()

  // Тот же resource + пересекающийся интервал → advisory-lock + overlap>=capacity.
  const { error: dupErr } = await createAppt(slotStart, slotEnd)
  expect(dupErr).not.toBeNull()
  expect(dupErr!.message).toContain('Slot is taken')
  expect(dupErr!.code).toBe('P0002')

  // Второй записи в БД нет — на слоте ровно одна.
  const { data: rows } = await svc
    .from('appointments')
    .select('id')
    .eq('resource_id', resourceId)
    .eq('starts_at', slotStart)
    .neq('status', 'cancelled')
  expect(rows).toHaveLength(1)
})

// ── 3. не-конфликт: тот же ресурс, непересекающийся слот ──────────────────────
test('create_appointments_bulk: тот же ресурс, слот +2ч → успех, вторая запись создана', async () => {
  const { error: e1 } = await createAppt(slotStart, slotEnd)
  expect(e1, e1?.message).toBeNull()

  const { error: e2 } = await createAppt(slot2Start, slot2End)
  expect(e2, e2?.message).toBeNull()

  const { data: rows } = await svc
    .from('appointments')
    .select('id')
    .eq('resource_id', resourceId)
    .eq('customer_name', MARKER)
  expect(rows).toHaveLength(2)
})

// ── 4. admin confirm (прямой UPDATE, как appointmentsApi.confirm) ─────────────
test('confirm: new → confirmed, confirmed_at не null', async () => {
  const { data } = await createAppt(slotStart, slotEnd)
  const apptId = (data as { appointments: Array<{ id: string }> }).appointments[0].id

  const { error } = await svc
    .from('appointments')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: ownerUserId })
    .eq('id', apptId)
  expect(error, error?.message).toBeNull()

  const { data: row } = await svc
    .from('appointments')
    .select('status, confirmed_at')
    .eq('id', apptId)
    .single()
  expect(row!.status).toBe('confirmed')
  expect(row!.confirmed_at).not.toBeNull()
})

// ── 5. admin cancel (прямой UPDATE, как appointmentsApi.cancel) ───────────────
test('cancel: → cancelled, cancel_reason/cancelled_by сохранены', async () => {
  const { data } = await createAppt(slotStart, slotEnd)
  const apptId = (data as { appointments: Array<{ id: string }> }).appointments[0].id

  const reason = 'клиент отменил'
  const { error } = await svc
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
      cancelled_by: 'admin',
    })
    .eq('id', apptId)
  expect(error, error?.message).toBeNull()

  const { data: row } = await svc
    .from('appointments')
    .select('status, cancel_reason, cancelled_by')
    .eq('id', apptId)
    .single()
  expect(row!.status).toBe('cancelled')
  expect(row!.cancel_reason).toBe(reason)
  expect(row!.cancelled_by).toBe('admin')
})

// ── 6. admin done (прямой UPDATE, как appointmentsApi.markDone) ───────────────
test('markDone: confirmed → done', async () => {
  const { data } = await createAppt(slotStart, slotEnd)
  const apptId = (data as { appointments: Array<{ id: string }> }).appointments[0].id

  await svc
    .from('appointments')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: ownerUserId })
    .eq('id', apptId)

  const { error } = await svc.from('appointments').update({ status: 'done' }).eq('id', apptId)
  expect(error, error?.message).toBeNull()

  const { data: row } = await svc.from('appointments').select('status').eq('id', apptId).single()
  expect(row!.status).toBe('done')
})

// ── 7. [fixme] cron auto-complete ────────────────────────────────────────────
// TODO: cron `appointments-auto-complete` (миграция 215) — это inline SQL прямо
// в cron.job, отдельной вызываемой функции НЕТ. Детерминированно дёрнуть в E2E
// без pg_cron-тика нельзя. Чтобы включить — вынести логику auto-complete в
// SECURITY DEFINER функцию и звать её здесь, ассертя переход confirmed→done по
// истёкшим ends_at.
test.fixme('cron auto-complete: истёкшие записи → done (нужна вызываемая функция)', async () => {
  // intentionally empty — см. TODO выше
})
