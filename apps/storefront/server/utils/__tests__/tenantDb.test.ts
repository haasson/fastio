/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTenantDb } from '../tenantDb'

// --- Mocks -----------------------------------------------------------------

/**
 * Флюентная цепочка Supabase-builder: каждый метод возвращает тот же объект,
 * чтобы можно было писать .from(...).eq(...).select(...).
 */
const mockChain = {
  eq: vi.fn(),
  select: vi.fn(),
  in: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  gt: vi.fn(),
  is: vi.fn(),
  not: vi.fn(),
  limit: vi.fn(),
}

// Каждый метод chainable возвращает сам mockChain
for (const key of Object.keys(mockChain) as (keyof typeof mockChain)[]) {
  mockChain[key].mockReturnValue(mockChain)
}

const mockFrom = vi.fn().mockReturnValue(mockChain)
const mockClient = { from: mockFrom }

vi.mock('../supabase', () => ({
  getServerSupabase: () => mockClient,
}))

// Мокаем h3 — createError должен бросать, как в реальном h3
vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    createError: (opts: { statusCode: number; message?: string }) => {
      const err = new Error(opts.message ?? String(opts.statusCode)) as Error & { statusCode: number }
      err.statusCode = opts.statusCode
      return err
    },
  }
})

// ---------------------------------------------------------------------------

function makeEvent(tenantId?: string) {
  return { context: { tenantId } } as any
}

// ---------------------------------------------------------------------------

describe('getTenantDb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Сбрасываем реализации chainable-методов после clearAllMocks
    for (const key of Object.keys(mockChain) as (keyof typeof mockChain)[]) {
      mockChain[key].mockReturnValue(mockChain)
    }
    mockFrom.mockReturnValue(mockChain)
  })

  // --- Базовое поведение ---------------------------------------------------

  it('возвращает объект с полями tenantId, from, junction, raw при валидном tenantId', () => {
    const db = getTenantDb(makeEvent('tenant-abc'))
    expect(db.tenantId).toBe('tenant-abc')
    expect(typeof db.from).toBe('function')
    expect(typeof db.junction).toBe('function')
    expect(db.raw).toBe(mockClient)
  })

  it('tenantId совпадает с тем что передали в event.context', () => {
    const db = getTenantDb(makeEvent('my-tenant-id'))
    expect(db.tenantId).toBe('my-tenant-id')
  })

  // --- Обработка ошибок ---------------------------------------------------

  it('бросает ошибку если tenantId = undefined', () => {
    expect(() => getTenantDb(makeEvent(undefined))).toThrow()
  })

  it('ошибка при отсутствующем tenantId имеет statusCode 400', () => {
    let caught: any
    try {
      getTenantDb(makeEvent(undefined))
    } catch (e) {
      caught = e
    }
    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(400)
  })

  it('бросает ошибку если tenantId = пустая строка', () => {
    // Пустая строка — falsy, должна триггерить guard
    expect(() => getTenantDb(makeEvent(''))).toThrow()
  })

  // --- db.from() — авто-фильтр по tenant_id --------------------------------

  it('db.from() вызывает sb.from() с правильной таблицей', () => {
    const db = getTenantDb(makeEvent('tenant-123'))
    db.from('orders')
    expect(mockFrom).toHaveBeenCalledWith('orders')
  })

  it('db.from() автоматически применяет .eq("tenant_id", tenantId)', () => {
    const db = getTenantDb(makeEvent('tenant-123'))
    // Proxy перехватывает select/update/delete и вставляет eq('tenant_id') после них
    db.from('orders').select('*')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123')
  })

  it('db.from() применяет tenant_id фильтр для другой таблицы', () => {
    const db = getTenantDb(makeEvent('tenant-xyz'))
    db.from('promotions').select('id, title')
    expect(mockFrom).toHaveBeenCalledWith('promotions')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-xyz')
  })

  it('db.from() возвращает query builder после .eq()', () => {
    const db = getTenantDb(makeEvent('tenant-123'))
    // proxy: select('*') → target.select('*').eq('tenant_id', ...) → mockChain
    const result = db.from('orders').select('*')
    expect(result).toBe(mockChain)
  })

  // --- db.junction() — без авто-фильтра ------------------------------------

  it('db.junction() вызывает sb.from() с правильной таблицей', () => {
    const db = getTenantDb(makeEvent('tenant-123'))
    db.junction('service_resources')
    expect(mockFrom).toHaveBeenCalledWith('service_resources')
  })

  it('db.junction() НЕ добавляет .eq("tenant_id", ...)', () => {
    const db = getTenantDb(makeEvent('tenant-123'))
    db.junction('service_resources')
    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', expect.anything())
  })

  it('db.junction() возвращает raw query builder без tenant фильтра', () => {
    const db = getTenantDb(makeEvent('tenant-123'))
    const result = db.junction('service_resources')
    expect(result).toBe(mockChain)
    expect(mockChain.eq).not.toHaveBeenCalled()
  })

  // --- db.raw — прямой доступ к клиенту ------------------------------------

  it('db.raw возвращает оригинальный supabase клиент', () => {
    const db = getTenantDb(makeEvent('tenant-123'))
    expect(db.raw).toBe(mockClient)
  })

  // --- Cross-tenant изоляция -----------------------------------------------

  it('два db с разными tenantId применяют разные фильтры', () => {
    const dbA = getTenantDb(makeEvent('tenant-A'))
    const dbB = getTenantDb(makeEvent('tenant-B'))

    dbA.from('orders').select('*')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')

    vi.clearAllMocks()
    for (const key of Object.keys(mockChain) as (keyof typeof mockChain)[]) {
      mockChain[key].mockReturnValue(mockChain)
    }
    mockFrom.mockReturnValue(mockChain)

    dbB.from('orders').select('*')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-B')
  })

  it('tenantId из одного db не утекает в другой db', () => {
    const dbA = getTenantDb(makeEvent('tenant-A'))
    const dbB = getTenantDb(makeEvent('tenant-B'))

    expect(dbA.tenantId).toBe('tenant-A')
    expect(dbB.tenantId).toBe('tenant-B')
    expect(dbA.tenantId).not.toBe(dbB.tenantId)
  })
})
