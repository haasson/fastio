/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type */

/**
 * Тесты POST /api/customer/addresses и PATCH /api/customer/addresses/[id]
 * — фокус на валидации длины полей (PREPROD-104).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError } from 'h3'

const VALID_ADDRESS_ID = '11111111-1111-4111-8111-111111111111'
const VALID_CUSTOMER_ID = '22222222-2222-4222-8222-222222222222'

type Resolved = { data: any; error: any }
const resolvers: Map<string, Resolved> = new Map()
function setResolver(key: string, value: Resolved) { resolvers.set(key, value) }
function getResolver(key: string): Resolved { return resolvers.get(key) ?? { data: null, error: null } }

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

const mockSupabase = {
  from: (table: string) => buildThenable(`from:${table}`),
}

vi.mock('../../../../utils/customerAuth', () => ({
  getAuthenticatedContext: vi.fn(async () => ({ customerId: VALID_CUSTOMER_ID, supabase: mockSupabase })),
}))

vi.mock('../../../../utils/supabase', () => ({
  mapCustomerAddress: (row: any) => ({ id: row.id, label: row.label, address: row.address }),
}))

const mockReportError = vi.fn()
vi.mock('~/shared/utils/reportError', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

;(globalThis as any).createError = createError
;(globalThis as any).defineEventHandler = (fn: Function) => fn
;(globalThis as any).getRouterParam = vi.fn(() => VALID_ADDRESS_ID)
;(globalThis as any).readBody = vi.fn().mockResolvedValue({})

function makeEvent() {
  return { context: { tenantId: 'tenant-A' }, headers: new Headers() } as any
}

const VALID_BODY = {
  address: 'ул. Ленина, 1',
  coordinates: { lat: 55.0, lng: 82.9 },
  label: 'Дом',
  comment: 'Звонить в дверь',
  entrance: '2',
  floor: '5',
  apartment: '17',
  intercom: '17K1234',
}

beforeEach(() => {
  vi.clearAllMocks()
  resolvers.clear()
  setResolver('from:customer_addresses', {
    data: { id: VALID_ADDRESS_ID, label: 'Дом', address: 'ул. Ленина, 1' },
    error: null,
  })
  ;(globalThis as any).readBody = vi.fn().mockResolvedValue(VALID_BODY)
  ;(globalThis as any).getRouterParam = vi.fn(() => VALID_ADDRESS_ID)
})

describe('POST /api/customer/addresses', () => {
  it('happy path: создаёт адрес с валидными полями', async () => {
    const { default: handler } = await import('../index.post')
    const result = await handler(makeEvent())
    expect(result).toEqual({ id: VALID_ADDRESS_ID, label: 'Дом', address: 'ул. Ленина, 1' })
  })

  it('400 если address пустой', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ ...VALID_BODY, address: '' })
    const { default: handler } = await import('../index.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если label > 100 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ ...VALID_BODY, label: 'x'.repeat(101) })
    const { default: handler } = await import('../index.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если address > 500 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ ...VALID_BODY, address: 'x'.repeat(501) })
    const { default: handler } = await import('../index.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если comment > 500 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ ...VALID_BODY, comment: 'x'.repeat(501) })
    const { default: handler } = await import('../index.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если entrance > 50 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ ...VALID_BODY, entrance: 'x'.repeat(51) })
    const { default: handler } = await import('../index.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если floor > 50 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ ...VALID_BODY, floor: 'x'.repeat(51) })
    const { default: handler } = await import('../index.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если apartment > 50 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ ...VALID_BODY, apartment: 'x'.repeat(51) })
    const { default: handler } = await import('../index.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если intercom > 50 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ ...VALID_BODY, intercom: 'x'.repeat(51) })
    const { default: handler } = await import('../index.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 при некорректных координатах', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ ...VALID_BODY, coordinates: { lat: 999, lng: 0 } })
    const { default: handler } = await import('../index.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('500 + reportError при ошибке insert', async () => {
    setResolver('from:customer_addresses', { data: null, error: { message: 'db down' } })
    const { default: handler } = await import('../index.post')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 500 })
    expect(mockReportError).toHaveBeenCalled()
  })
})

describe('PATCH /api/customer/addresses/[id]', () => {
  beforeEach(() => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ label: 'Работа' })
  })

  it('happy path: обновляет label', async () => {
    setResolver('from:customer_addresses', {
      data: { id: VALID_ADDRESS_ID, label: 'Работа', address: 'ул. Ленина, 1' },
      error: null,
    })
    const { default: handler } = await import('../[id].patch')
    const result = await handler(makeEvent())
    expect(result.label).toBe('Работа')
  })

  it('400 если нет id в роуте', async () => {
    ;(globalThis as any).getRouterParam = vi.fn(() => undefined)
    const { default: handler } = await import('../[id].patch')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если label > 100 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ label: 'x'.repeat(101) })
    const { default: handler } = await import('../[id].patch')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если address > 500 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ address: 'x'.repeat(501) })
    const { default: handler } = await import('../[id].patch')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если comment > 500 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ comment: 'x'.repeat(501) })
    const { default: handler } = await import('../[id].patch')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если apartment > 50 символов', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ apartment: 'x'.repeat(51) })
    const { default: handler } = await import('../[id].patch')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если поле не строка', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ label: 123 })
    const { default: handler } = await import('../[id].patch')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400 если updates пустые', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({})
    const { default: handler } = await import('../[id].patch')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('404 если адрес не найден', async () => {
    setResolver('from:customer_addresses', { data: null, error: null })
    const { default: handler } = await import('../[id].patch')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 404 })
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('500 + reportError при ошибке БД', async () => {
    setResolver('from:customer_addresses', { data: null, error: { message: 'db down' } })
    const { default: handler } = await import('../[id].patch')
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 500 })
    expect(mockReportError).toHaveBeenCalled()
  })
})
