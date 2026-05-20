/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type */

/**
 * PREPROD-210: POST /api/auth/revoke-all-sessions
 *
 * DELETE FROM customer_sessions WHERE customer_id = current_customer (+ tenant_id фильтр
 * через tenantDb proxy). Возвращает { ok: true, revoked: N }, чистит tg_session cookie.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError } from 'h3'

const VALID_CUSTOMER_ID = '22222222-2222-4222-8222-222222222222'

// Захватываем все вызовы DELETE для assertions.
let deleteResult: { error: unknown; count: number | null } = { error: null, count: 0 }
const deleteCalls: Array<{ deleteArgs: unknown[]; eqs: Array<[string, unknown]> }> = []
const deletedCookies: Array<{ name: string }> = []

function buildDeleteBuilder() {
  const eqs: Array<[string, unknown]> = []
  let captured: { deleteArgs: unknown[] } | null = null
  const builder: any = {
    delete(...args: unknown[]) {
      captured = { deleteArgs: args }
      return builder
    },
    eq(col: string, val: unknown) {
      eqs.push([col, val])
      return builder
    },
    then(resolve: (v: typeof deleteResult) => unknown) {
      if (captured) deleteCalls.push({ ...captured, eqs: [...eqs] })
      return Promise.resolve(deleteResult).then(resolve)
    },
  }
  return builder
}

vi.mock('../../../utils/customerAuth', () => ({
  getAuthenticatedContext: vi.fn(async () => ({ customerId: VALID_CUSTOMER_ID, supabase: {} })),
}))

vi.mock('../../../utils/tenantDb', () => ({
  getTenantDb: () => ({
    tenantId: 'tenant-A',
    from(_table: string) {
      return buildDeleteBuilder()
    },
  }),
}))

const mockReportError = vi.fn()
vi.mock('~/shared/utils/reportError', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

;(globalThis as any).createError = createError
;(globalThis as any).defineEventHandler = (fn: Function) => fn

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    deleteCookie: vi.fn((_event: unknown, name: string) => {
      deletedCookies.push({ name })
    }),
  }
})

function makeEvent() {
  return { context: { tenantId: 'tenant-A' }, headers: new Headers() } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  deleteResult = { error: null, count: 0 }
  deleteCalls.length = 0
  deletedCookies.length = 0
})

describe('POST /api/auth/revoke-all-sessions', () => {
  it('happy path: возвращает { ok: true, revoked: N } и чистит cookie', async () => {
    deleteResult = { error: null, count: 3 }

    const { default: handler } = await import('../revoke-all-sessions.post')
    const result = await handler(makeEvent())

    expect(result).toEqual({ ok: true, revoked: 3 })

    // Один DELETE с фильтром customer_id (tenant_id инжектится proxy'м tenantDb)
    expect(deleteCalls).toHaveLength(1)
    expect(deleteCalls[0].eqs).toContainEqual(['customer_id', VALID_CUSTOMER_ID])
    // delete вызван с { count: 'exact' } — мы передаём options для возврата count
    expect(deleteCalls[0].deleteArgs[0]).toEqual({ count: 'exact' })

    // Серверная кука tg_session стёрта — клиент сразу видит разлогин
    expect(deletedCookies).toHaveLength(1)
    expect(deletedCookies[0].name).toBe('tg_session')
  })

  it('revoked=0 если нет сессий (защита от NaN)', async () => {
    deleteResult = { error: null, count: null }

    const { default: handler } = await import('../revoke-all-sessions.post')
    const result = await handler(makeEvent())

    expect(result).toEqual({ ok: true, revoked: 0 })
  })

  it('500 + reportError при ошибке DELETE', async () => {
    deleteResult = { error: { message: 'db down' }, count: null }

    const { default: handler } = await import('../revoke-all-sessions.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 500 })
    expect(mockReportError).toHaveBeenCalled()
  })
})
