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
}))

vi.mock('../../../utils/auth', () => ({
  requireTelegramWebhookSecret: vi.fn(),
}))

let pendingRow: { nonce: string } | null = null
const updateCalls: Array<{ values: Record<string, unknown>; eqs: Array<[string, unknown]>; iss: Array<[string, unknown]>; gts: Array<[string, unknown]> }> = []

vi.mock('../../../utils/supabase', () => ({
  getServerSupabase: () => ({
    from(_table: string) {
      return makeQueryBuilder()
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
