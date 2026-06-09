/**
 * Integration-тест для RPC `billing_activate_plan` (318_billing_activate_plan.sql).
 *
 * Tenant-инициированная реактивация/выбор тарифа из баланса для заблокированного
 * тенанта (suspended/past_due). Списывает цену выбранного плана и переводит
 * подписку в active. Двойник кронового billing_charge_subscription, но с
 * caller-guard (service_role ИЛИ has_permission billing.manage).
 *
 * Запуск:
 *   RUN_SUPABASE_INTEGRATION=1 \
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   SUPABASE_ANON_KEY=<anon-key> \   # опционально — для ветки caller-guard
 *   pnpm vitest run supabase/tests/billing_activate_plan.test.ts
 *
 * Без флага тест скипается, чтобы не блокировать `pnpm test:run` (где живая БД
 * может быть недоступна).
 *
 * Фикстура: 1 tenant с управляемой подпиской (без auth-юзера — RPC его не требует,
 * service_role обходит caller-guard, created_by nullable). Прямые UPDATE
 * subscription/balance разрешены, т.к. service-role сессия проходит trigger
 * prevent_billing_self_update (067_billing_rls.sql: current_setting('role')=
 * 'service_role'). Состояние сбрасывается перед каждым сценарием.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const enabled = process.env.RUN_SUPABASE_INTEGRATION === '1'
  && Boolean(process.env.SUPABASE_URL)
  && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const TEST_PREFIX = `activate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

type Sub = {
  status: string
  plan: string
  renewsAt: string | null
  pastDueAt?: string | null
  trialEndsAt?: string | null
  priceOverride?: number
  gracePeriodDays?: number
}

describe.skipIf(!enabled)('billing_activate_plan RPC (live DB)', () => {
  let sb: SupabaseClient
  let tenantId: string
  let proPrice: number
  let showcaseKey: string
  let showcasePrice: number
  let testStart: string
  let origSub: unknown
  let origBalance: number
  let origModules: unknown

  const setSub = async (sub: Sub, balance: number) => {
    const { error } = await sb.from('tenants').update({ subscription: sub, balance }).eq('id', tenantId)

    expect(error).toBeNull()
  }

  // Очистить модули (для чистого даунгрейда без конфликтов) или включить конкретный.
  const setModules = async (modules: Record<string, boolean>) => {
    const { error } = await sb.from('tenants').update({ modules }).eq('id', tenantId)

    expect(error).toBeNull()
  }

  const txCount = async (): Promise<number> => {
    const { count } = await sb
      .from('billing_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    return count ?? 0
  }

  beforeAll(async () => {
    sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // retail-pro = «Про», retail-showcase = бесплатный/дешёвый — тащим реальные цены из БД.
    const { data: pro } = await sb.from('plans').select('price').eq('key', 'retail-pro').single()

    proPrice = Number(pro!.price)

    const { data: showcase } = await sb
      .from('plans')
      .select('key, price')
      .eq('business_type', 'retail')
      .order('sort_order', { ascending: true })
      .limit(1)
      .single()

    showcaseKey = showcase!.key
    showcasePrice = Number(showcase!.price)

    // Создавать/удалять тенанта в тесте мешают лайфсайкл-триггеры (авто-membership
    // на INSERT, prevent_delete_last_new_status на каскадном DELETE order_statuses).
    // Поэтому переиспользуем существующий retail-тенант: снимаем снапшот
    // subscription/balance и восстанавливаем в afterAll. Сценарии задают состояние
    // прямым UPDATE (service-role проходит trigger prevent_billing_self_update).
    const { data: seed, error: seedErr } = await sb
      .from('tenants')
      .select('id, subscription, balance, modules')
      .eq('business_type', 'retail')
      .limit(1)
      .single()

    if (seedErr || !seed) throw new Error(`Нет retail-тенанта для фикстуры: ${seedErr?.message}`)

    tenantId = seed.id
    origSub = seed.subscription
    origBalance = Number(seed.balance)
    origModules = seed.modules
    testStart = new Date().toISOString()
  })

  afterAll(async () => {
    if (!tenantId) return
    // Чистим только созданные тестом транзакции и возвращаем подписку/баланс/модули.
    await sb.from('billing_transactions').delete().eq('tenant_id', tenantId).gte('created_at', testStart)
    await sb.from('tenants').update({ subscription: origSub, balance: origBalance, modules: origModules }).eq('id', tenantId)
  })

  it('suspended + баланса хватает, свой план → activated, списание, +1 charge tx', async () => {
    await setSub({ status: 'suspended', plan: 'retail-pro', renewsAt: null, pastDueAt: '2026-06-05T03:00:00Z' }, 5000)
    const before = await txCount()

    const { data, error } = await sb.rpc('billing_activate_plan', { p_tenant_id: tenantId, p_plan_key: 'retail-pro' })

    expect(error).toBeNull()
    expect(data).toBe('activated')

    const { data: t } = await sb.from('tenants').select('balance, subscription').eq('id', tenantId).single()

    expect(Number(t!.balance)).toBe(5000 - proPrice)
    expect(t!.subscription.status).toBe('active')
    expect(t!.subscription.pastDueAt).toBeNull()
    expect(new Date(t!.subscription.renewsAt).getTime()).toBeGreaterThan(Date.now())
    expect(await txCount()).toBe(before + 1)
  })

  it('suspended + баланса не хватает → ошибка «Недостаточно средств»', async () => {
    await setSub({ status: 'suspended', plan: 'retail-pro', renewsAt: null }, 100)

    const { error } = await sb.rpc('billing_activate_plan', { p_tenant_id: tenantId, p_plan_key: 'retail-pro' })

    expect(error).not.toBeNull()
    expect(error!.message).toContain('Недостаточно средств')
  })

  it('active + renewsAt в будущем → already_active, баланс не тронут', async () => {
    const future = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString()

    await setSub({ status: 'active', plan: 'retail-pro', renewsAt: future }, 5000)

    const { data, error } = await sb.rpc('billing_activate_plan', { p_tenant_id: tenantId, p_plan_key: 'retail-pro' })

    expect(error).toBeNull()
    expect(data).toBe('already_active')

    const { data: t } = await sb.from('tenants').select('balance').eq('id', tenantId).single()

    expect(Number(t!.balance)).toBe(5000)
  })

  it('trial → already_active, без списания (триал не обрывается)', async () => {
    await setSub({ status: 'trial', plan: 'retail-pro', renewsAt: null, trialEndsAt: '2026-07-01T00:00:00Z' }, 5000)

    const { data, error } = await sb.rpc('billing_activate_plan', { p_tenant_id: tenantId, p_plan_key: 'retail-pro' })

    expect(error).toBeNull()
    expect(data).toBe('already_active')

    const { data: t } = await sb.from('tenants').select('balance').eq('id', tenantId).single()

    expect(Number(t!.balance)).toBe(5000)
  })

  it('переход на другой план (даунгрейд) → activated, цена нового, priceOverride сброшен', async () => {
    // Чистим модули — иначе guard модульных конфликтов заблокирует даунгрейд.
    await setModules({})
    await setSub({ status: 'suspended', plan: 'retail-pro', renewsAt: null, priceOverride: 1234 }, 5000)

    const { data, error } = await sb.rpc('billing_activate_plan', { p_tenant_id: tenantId, p_plan_key: showcaseKey })

    expect(error).toBeNull()
    expect(data).toBe('activated')

    const { data: t } = await sb.from('tenants').select('balance, subscription').eq('id', tenantId).single()

    expect(t!.subscription.plan).toBe(showcaseKey)
    expect(Number(t!.balance)).toBe(5000 - showcasePrice)
    expect(t!.subscription.priceOverride).toBeUndefined()
  })

  it('даунгрейд с включённым премиум-модулем → ошибка «отключите модули»', async () => {
    // combos требует тир pro (module_configs.required_plan_key='pro'). Guard матчит
    // его как retail-pro и блокирует переход на retail-start (319/318 fix).
    await setModules({ combos: true })
    await setSub({ status: 'suspended', plan: 'retail-pro', renewsAt: null }, 5000)

    const { error } = await sb.rpc('billing_activate_plan', { p_tenant_id: tenantId, p_plan_key: 'retail-start' })

    expect(error).not.toBeNull()
    expect(error!.message).toContain('отключите модули')
  })

  it('свой план с priceOverride → списываем override, override сохраняется', async () => {
    await setSub({ status: 'suspended', plan: 'retail-pro', renewsAt: null, priceOverride: 1000 }, 5000)

    const { data, error } = await sb.rpc('billing_activate_plan', { p_tenant_id: tenantId, p_plan_key: 'retail-pro' })

    expect(error).toBeNull()
    expect(data).toBe('activated')

    const { data: t } = await sb.from('tenants').select('balance, subscription').eq('id', tenantId).single()

    expect(Number(t!.balance)).toBe(4000)
    expect(t!.subscription.priceOverride).toBe(1000)
  })

  it('caller-guard: anon-клиент без permission → ошибка (forbidden / permission denied)', async () => {
    const anonKey = process.env.SUPABASE_ANON_KEY

    if (!anonKey) return // anon-ключ не задан — пропускаем ветку guard'а

    const anon = createClient(process.env.SUPABASE_URL!, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    await setSub({ status: 'suspended', plan: 'retail-pro', renewsAt: null }, 5000)

    const { error } = await anon.rpc('billing_activate_plan', { p_tenant_id: tenantId, p_plan_key: 'retail-pro' })

    expect(error).not.toBeNull()
  })
})
