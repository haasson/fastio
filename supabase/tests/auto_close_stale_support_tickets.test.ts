/**
 * PREPROD-204: integration-тест для RPC `auto_close_stale_support_tickets`.
 *
 * RPC бежит ежедневно по cron'у (`118_support_auto_close.sql`) и закрывает тикеты
 * со статусом `waiting_for_reply`, у которых `updated_at < now() - interval '5 days'`.
 * То есть: саппорт написал → тенант не ответил 5+ дней → автозакрытие.
 *
 * Запуск:
 *   RUN_SUPABASE_INTEGRATION=1 \
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt> \
 *   pnpm vitest run supabase/tests/auto_close_stale_support_tickets.test.ts
 *
 * Без флага тест скипается, чтобы не блокировать `pnpm test:run` (где живая БД
 * может быть недоступна). В nightly-job с поднятым supabase прогон будет
 * полноценным.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const enabled = process.env.RUN_SUPABASE_INTEGRATION === '1'
  && Boolean(process.env.SUPABASE_URL)
  && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const TEST_PREFIX = `preprod204-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(!enabled)('auto_close_stale_support_tickets RPC (live DB)', () => {
  let sb: SupabaseClient
  let userId: string
  let tenantId: string

  // Создаём изолированную фикстуру: 1 user → 1 tenant. Тикеты создаём в тестах.
  // Cleanup в afterAll каскадно удалит тикеты через ON DELETE CASCADE на tenant.
  beforeAll(async () => {
    sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Создаём auth-юзера через Admin API. email_confirm=true чтобы пропустить
    // verification flow (не нужен для теста).
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email: `${TEST_PREFIX}@test.invalid`,
      password: 'preprod204-test-password',
      email_confirm: true,
    })

    if (createErr || !created.user) {
      throw new Error(`Не удалось создать тест-юзера: ${createErr?.message}`)
    }
    userId = created.user.id

    // ON DELETE CASCADE на tenants → support_tickets — корректно подчищает.
    const { data: tenant, error: tenantErr } = await sb
      .from('tenants')
      .insert({
        owner_id: userId,
        name: `Test ${TEST_PREFIX}`,
        slug: TEST_PREFIX.toLowerCase(),
      })
      .select('id')
      .single()

    if (tenantErr || !tenant) {
      // Чистим юзера если не создался тенант
      await sb.auth.admin.deleteUser(userId)
      throw new Error(`Не удалось создать тест-тенант: ${tenantErr?.message}`)
    }
    tenantId = tenant.id
  })

  afterAll(async () => {
    // Каскад через FK очистит support_tickets / support_messages.
    if (tenantId) await sb.from('tenants').delete().eq('id', tenantId)
    if (userId) await sb.auth.admin.deleteUser(userId)
  })

  it('старый waiting_for_reply (updated_at > 5 дней назад) → закрывается', async () => {
    // Тикет с updated_at = 6 дней назад. INSERT'им с явным updated_at — BEFORE UPDATE
    // trigger тут не сработает (мы делаем INSERT, не UPDATE).
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString()
    const { data: ticket, error: insErr } = await sb
      .from('support_tickets')
      .insert({
        tenant_id: tenantId,
        subject: 'old-waiting',
        status: 'waiting_for_reply',
        created_by: userId,
        updated_at: sixDaysAgo,
      })
      .select('id')
      .single()

    expect(insErr).toBeNull()
    expect(ticket).not.toBeNull()

    const { error: rpcErr } = await sb.rpc('auto_close_stale_support_tickets')
    expect(rpcErr).toBeNull()

    const { data: after } = await sb
      .from('support_tickets')
      .select('status')
      .eq('id', ticket!.id)
      .single()

    expect(after?.status).toBe('resolved')
  })

  it('свежий waiting_for_reply (updated_at = вчера) → НЕ закрывается', async () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
    const { data: ticket, error: insErr } = await sb
      .from('support_tickets')
      .insert({
        tenant_id: tenantId,
        subject: 'fresh-waiting',
        status: 'waiting_for_reply',
        created_by: userId,
        updated_at: yesterday,
      })
      .select('id')
      .single()

    expect(insErr).toBeNull()

    const { error: rpcErr } = await sb.rpc('auto_close_stale_support_tickets')
    expect(rpcErr).toBeNull()

    const { data: after } = await sb
      .from('support_tickets')
      .select('status')
      .eq('id', ticket!.id)
      .single()

    expect(after?.status).toBe('waiting_for_reply')
  })

  it('open (любой возраст) → НЕ закрывается (только waiting_for_reply)', async () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString()
    const { data: ticket, error: insErr } = await sb
      .from('support_tickets')
      .insert({
        tenant_id: tenantId,
        subject: 'old-open',
        status: 'open',
        created_by: userId,
        updated_at: sixDaysAgo,
      })
      .select('id')
      .single()

    expect(insErr).toBeNull()

    const { error: rpcErr } = await sb.rpc('auto_close_stale_support_tickets')
    expect(rpcErr).toBeNull()

    const { data: after } = await sb
      .from('support_tickets')
      .select('status')
      .eq('id', ticket!.id)
      .single()

    expect(after?.status).toBe('open')
  })

  it('уже resolved → не трогается (status остаётся resolved)', async () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString()
    const { data: ticket, error: insErr } = await sb
      .from('support_tickets')
      .insert({
        tenant_id: tenantId,
        subject: 'already-resolved',
        status: 'resolved',
        created_by: userId,
        updated_at: sixDaysAgo,
      })
      .select('id')
      .single()

    expect(insErr).toBeNull()

    const { error: rpcErr } = await sb.rpc('auto_close_stale_support_tickets')
    expect(rpcErr).toBeNull()

    const { data: after } = await sb
      .from('support_tickets')
      .select('status')
      .eq('id', ticket!.id)
      .single()

    expect(after?.status).toBe('resolved')
  })
})

describe.skipIf(enabled)('auto_close_stale_support_tickets RPC (skipped — нет живой БД)', () => {
  it('skip placeholder: для прогона задайте RUN_SUPABASE_INTEGRATION=1 + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY', () => {
    expect(true).toBe(true)
  })
})
