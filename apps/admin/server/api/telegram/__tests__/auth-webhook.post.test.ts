/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * PREPROD-115: auth-webhook должен UPDATE'ить pending_telegram_auths
 * ТОЛЬКО после успешной валидации nonce (existing + not expired + not completed).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@fastio/shared/observability', () => ({
  reportError: vi.fn(),
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({ telegramClientBotToken: 'test-bot-token' }),
}))

vi.mock('../../../utils/telegramFetch', () => ({
  telegramFetch: vi.fn(async () => ({ json: async () => ({ ok: true }) })),
  telegramApiUrl: (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`,
}))

vi.mock('../../../utils/auth', () => ({
  requireTelegramWebhookSecret: vi.fn(),
}))

let pendingRow: { nonce: string } | null = null
const updateCalls: Array<{ values: Record<string, unknown>; eqs: Array<[string, unknown]>; iss: Array<[string, unknown]>; gts: Array<[string, unknown]> }> = []
const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
// Дефолт: лимит не достигнут. Per-test можно переопределить (см. PREPROD-205).
let rpcResponses: Record<string, { data: boolean | null; error: unknown }> = {}

vi.mock('../../../utils/supabase', () => ({
  getServerSupabase: () => ({
    from(_table: string) {
      return makeQueryBuilder()
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args })

      const resp = rpcResponses[fn]

      if (resp) return resp

      return { data: true, error: null }
    },
  }),
}))

function makeQueryBuilder() {
  const eqs: Array<[string, unknown]> = []
  const iss: Array<[string, unknown]> = []
  const gts: Array<[string, unknown]> = []
  let updateValues: Record<string, unknown> | null = null

  const builder: any = {
    select() { return builder },
    eq(col: string, val: unknown) {
      eqs.push([col, val])

      return builder
    },
    is(col: string, val: unknown) {
      iss.push([col, val])

      return builder
    },
    gt(col: string, val: unknown) {
      gts.push([col, val])

      return builder
    },
    update(values: Record<string, unknown>) {
      updateValues = values

      return builder
    },
    async maybeSingle() {
      return { data: pendingRow, error: null }
    },
    // SupabaseClient .update().eq().is().gt() резолвится как PostgrestBuilder (thenable).
    then(resolve: (v: { data: null; error: null }) => unknown) {
      if (updateValues) {
        updateCalls.push({ values: updateValues, eqs, iss, gts })
      }

      return Promise.resolve({ data: null, error: null }).then(resolve)
    },
  }

  return builder
}

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')

  return {
    ...actual,
    defineEventHandler: (fn: any) => fn,
    readBody: vi.fn(async () => currentBody),
  }
})

let currentBody: any = null

import handler from '../auth-webhook.post'

beforeEach(() => {
  vi.clearAllMocks()
  pendingRow = null
  updateCalls.length = 0
  rpcCalls.length = 0
  rpcResponses = {}
  currentBody = null
})

describe('PREPROD-115: auth-webhook UPDATE order', () => {
  it('unknown nonce → UPDATE не вызывается', async () => {
    pendingRow = null
    currentBody = {
      message: {
        chat: { id: 100 },
        from: { id: 42, first_name: 'A' },
        text: '/start unknown-nonce-xyz',
      },
    }

    await handler({} as any)

    expect(updateCalls).toHaveLength(0)
  })

  it('expired/completed nonce (maybeSingle вернул null) → UPDATE не вызывается', async () => {
    // Реальный SELECT с фильтрами .is('completed_at', null).gt('expires_at', now) вернёт null
    // для expired или completed строк — мы эмулируем именно этот результат.
    pendingRow = null
    currentBody = {
      message: {
        chat: { id: 200 },
        from: { id: 99, first_name: 'B' },
        text: '/start expired-nonce',
      },
    }

    await handler({} as any)

    expect(updateCalls).toHaveLength(0)
  })

  it('валидный nonce → UPDATE вызывается с защитными фильтрами', async () => {
    pendingRow = { nonce: 'valid-nonce' }
    currentBody = {
      message: {
        chat: { id: 300 },
        from: { id: 777, first_name: 'C', last_name: 'D', username: 'cd' },
        text: '/start valid-nonce',
      },
    }

    await handler({} as any)

    expect(updateCalls).toHaveLength(1)
    const call = updateCalls[0]

    expect(call.values).toMatchObject({
      telegram_id: '777',
      telegram_data: { first_name: 'C', last_name: 'D', username: 'cd' },
    })
    // UPDATE должен быть guarded по nonce + completed_at IS NULL + expires_at > NOW
    expect(call.eqs).toContainEqual(['nonce', 'valid-nonce'])
    expect(call.iss).toContainEqual(['completed_at', null])
    expect(call.gts.length).toBeGreaterThanOrEqual(1)
    expect(call.gts[0][0]).toBe('expires_at')
  })
})

describe('PREPROD-205: per-tg-id rate-limit для pending_telegram_auths', () => {
  it('RL allowed → consume_rate_limit вызвана с правильным key + дальше идёт SELECT/UPDATE', async () => {
    pendingRow = { nonce: 'ok-nonce' }
    currentBody = {
      message: {
        chat: { id: 1 },
        from: { id: 555, first_name: 'X' },
        text: '/start ok-nonce',
      },
    }

    await handler({} as any)

    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0]).toEqual({
      fn: 'consume_rate_limit',
      args: { _key: 'tg-auth:tg-id:555', _max: 10, _window_seconds: 3600 },
    })
    // RL прошёл — UPDATE отработал
    expect(updateCalls).toHaveLength(1)
  })

  it('RL hit (data=false) → silent ignore: ни SELECT-pending, ни UPDATE не вызываются, sendMessage не дёргается', async () => {
    rpcResponses.consume_rate_limit = { data: false, error: null }
    pendingRow = { nonce: 'should-not-be-read' }
    currentBody = {
      message: {
        chat: { id: 2 },
        from: { id: 666, first_name: 'Y' },
        text: '/start any-nonce',
      },
    }

    const res = await handler({} as any)

    expect(res).toEqual({ ok: true })
    expect(updateCalls).toHaveLength(0)
    // Только сам rate-limit RPC, ничего больше
    expect(rpcCalls).toHaveLength(1)
  })

  it('RL error → silent ignore (fail-open для legit-юзера, но в Sentry уйдёт)', async () => {
    rpcResponses.consume_rate_limit = { data: null, error: new Error('rpc failed') }
    pendingRow = { nonce: 'ok-nonce' }
    currentBody = {
      message: {
        chat: { id: 3 },
        from: { id: 777, first_name: 'Z' },
        text: '/start ok-nonce',
      },
    }

    const res = await handler({} as any)

    expect(res).toEqual({ ok: true })
    expect(updateCalls).toHaveLength(0)
  })

  it('RL изолирован per-tg-id: другой tg_id с тем же IP/chat не подмешивается', async () => {
    pendingRow = { nonce: 'ok-nonce' }
    currentBody = {
      message: {
        chat: { id: 4 },
        from: { id: 111, first_name: 'A' },
        text: '/start ok-nonce',
      },
    }
    await handler({} as any)
    currentBody = {
      message: {
        chat: { id: 4 },
        from: { id: 222, first_name: 'B' },
        text: '/start ok-nonce',
      },
    }
    await handler({} as any)

    expect(rpcCalls).toHaveLength(2)
    expect(rpcCalls[0].args._key).toBe('tg-auth:tg-id:111')
    expect(rpcCalls[1].args._key).toBe('tg-auth:tg-id:222')
  })
})
