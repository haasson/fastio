/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type */

/**
 * Тесты POST /api/table/[id]/call — вызов официанта со стола.
 *
 * Покрывает: UUID-валидацию tableId/callTypeId, IDOR guard (cookie fastio_table),
 * rate-limit (consume_rate_limit RPC) с retryAfter, валидацию стола (is_open/is_active),
 * опциональный callTypeId с снапшотом name, успешный insert + cooldownSeconds.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError } from 'h3'

// ──────────────────────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────────────────────

type Resolved = { data: any; error: any }

const resolvers: Map<string, Resolved> = new Map()
function setResolver(key: string, value: Resolved) {
  resolvers.set(key, value)
}
function getResolver(key: string): Resolved {
  return resolvers.get(key) ?? { data: null, error: null }
}

function buildThenable(key: string) {
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: (v: Resolved) => unknown) => resolve(getResolver(key))
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => Promise.resolve(getResolver(key))
      }
      return () => proxy
    },
  }
  const proxy: any = new Proxy({}, handler)
  return proxy
}

const mockRpc = vi.fn()

vi.mock('../../../utils/tenantDb', () => ({
  getTenantDb: vi.fn(() => ({
    tenantId: 'tenant-A',
    from: (table: string) => buildThenable(`from:${table}`),
    crossTenant: {
      from: (table: string) => buildThenable(`crossTenant:${table}`),
      rpc: (...args: unknown[]) => mockRpc(...args),
    },
  })),
}))

const mockReportError = vi.fn()
vi.mock('@fastio/shared/observability', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

// Nuxt globals
const cookieJar: Record<string, string> = {}
const VALID_TABLE_ID = '11111111-1111-4111-8111-111111111111'
const VALID_TYPE_ID = '22222222-2222-4222-8222-222222222222'

;(globalThis as any).createError = createError
;(globalThis as any).defineEventHandler = (fn: Function) => fn
;(globalThis as any).getRouterParam = vi.fn(() => VALID_TABLE_ID)
;(globalThis as any).getCookie = vi.fn((_e: unknown, name: string) => cookieJar[name])
;(globalThis as any).readBody = vi.fn().mockResolvedValue({})

// ──────────────────────────────────────────────────────────────────────────
// Хелперы
// ──────────────────────────────────────────────────────────────────────────

function happyPath(overrides: Record<string, Resolved> = {}) {
  resolvers.clear()
  setResolver('from:tables', { data: { id: VALID_TABLE_ID, is_open: true, is_active: true }, error: null })
  setResolver('crossTenant:table_calls', {
    data: { id: 'call-1', created_at: '2026-05-19T12:00:00Z', call_type_name: 'Вызвать официанта' },
    error: null,
  })
  for (const [k, v] of Object.entries(overrides)) setResolver(k, v)
}

function makeEvent() {
  return { context: { tenantId: 'tenant-A' }, headers: new Headers() } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(cookieJar)) delete cookieJar[k]
  cookieJar.fastio_table = VALID_TABLE_ID
  ;(globalThis as any).getRouterParam = vi.fn(() => VALID_TABLE_ID)
  ;(globalThis as any).readBody = vi.fn().mockResolvedValue({})
  mockRpc.mockResolvedValue({ data: true, error: null })
})

// ──────────────────────────────────────────────────────────────────────────
// Тесты
// ──────────────────────────────────────────────────────────────────────────

describe('POST /api/table/[id]/call', () => {
  it('успешно создаёт вызов с дефолтным типом (без callTypeId) + cooldownSeconds', async () => {
    happyPath()
    const { default: handler } = await import('../[id]/call.post')

    const result = await handler(makeEvent())

    expect(result).toEqual({
      call: { id: 'call-1', created_at: '2026-05-19T12:00:00Z', call_type_name: 'Вызвать официанта' },
      cooldownSeconds: 30,
    })
    expect(mockRpc).toHaveBeenCalledWith('consume_rate_limit', {
      _key: `table-call:${VALID_TABLE_ID}`,
      _max: 1,
      _window_seconds: 30,
    })
  })

  it('успешно создаёт вызов с явным callTypeId (берёт name из БД)', async () => {
    happyPath({
      'from:table_call_types': { data: { id: VALID_TYPE_ID, name: 'Принесите счёт' }, error: null },
      'crossTenant:table_calls': {
        data: { id: 'call-2', created_at: '2026-05-19T12:00:00Z', call_type_name: 'Принесите счёт' },
        error: null,
      },
    })
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ callTypeId: VALID_TYPE_ID })
    const { default: handler } = await import('../[id]/call.post')

    const result = await handler(makeEvent())

    expect(result.call.call_type_name).toBe('Принесите счёт')
  })

  it('400 если tableId не UUID', async () => {
    happyPath()
    ;(globalThis as any).getRouterParam = vi.fn(() => 'not-a-uuid')
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
    // НЕ должны были долезть до rate-limit / DB-запросов
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('400 если callTypeId не UUID (без обращения к DB)', async () => {
    happyPath()
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ callTypeId: 'хххх' })
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
    // reportError НЕ должен быть вызван — это user input, не Sentry case
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('403 если нет cookie fastio_table', async () => {
    happyPath()
    delete cookieJar.fastio_table
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 403 })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('403 если cookie fastio_table не совпадает с tableId', async () => {
    happyPath()
    cookieJar.fastio_table = '99999999-9999-4999-8999-999999999999'
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 403 })
  })

  it('429 с retryAfter при срабатывании rate-limit (rate-limit идёт ДО select-ов)', async () => {
    happyPath()
    mockRpc.mockResolvedValueOnce({ data: false, error: null })
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 429,
      data: { retryAfter: 30 },
    })
  })

  it('404 если стол не найден или is_active=false', async () => {
    happyPath({
      'from:tables': { data: { id: VALID_TABLE_ID, is_open: true, is_active: false }, error: null },
    })
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 404 })
  })

  it('400 если стол закрыт (is_open=false)', async () => {
    happyPath({
      'from:tables': { data: { id: VALID_TABLE_ID, is_open: false, is_active: true }, error: null },
    })
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если callTypeId — UUID но не существует', async () => {
    happyPath({
      'from:table_call_types': { data: null, error: null },
    })
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ callTypeId: VALID_TYPE_ID })
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('500 + reportError при ошибке insert', async () => {
    happyPath({
      'crossTenant:table_calls': { data: null, error: { message: 'boom' } },
    })
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 500 })
    expect(mockReportError).toHaveBeenCalled()
  })

  it('500 + reportError при ошибке получения стола', async () => {
    happyPath({
      'from:tables': { data: null, error: { message: 'db down' } },
    })
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 500 })
    expect(mockReportError).toHaveBeenCalled()
  })

  it('500 + reportError при ошибке RPC consume_rate_limit', async () => {
    happyPath()
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc down' } })
    const { default: handler } = await import('../[id]/call.post')

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 500 })
    expect(mockReportError).toHaveBeenCalled()
  })
})
