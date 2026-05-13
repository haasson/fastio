/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type */

/**
 * Cross-tenant isolation tests
 *
 * Проверяем что каждый server endpoint ОБЯЗАТЕЛЬНО применяет .eq('tenant_id', X)
 * через getTenantDb(). Если кто-то уберёт getTenantDb() или сделает прямой запрос
 * без tenant фильтра — эти тесты упадут.
 *
 * Стратегия: мокаем supabase-клиент и проверяем вызовы .eq('tenant_id', ...).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createError, getCookie, getQuery, getRouterParam } from 'h3'

// ---------------------------------------------------------------------------
// Флюентная цепочка Supabase-builder
// ---------------------------------------------------------------------------

const mockChain: Record<string, ReturnType<typeof vi.fn>> = {
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

function resetChain() {
  for (const key of Object.keys(mockChain)) {
    mockChain[key].mockReset()
    mockChain[key].mockReturnValue(mockChain)
  }
}

const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockClient = { from: mockFrom, rpc: mockRpc }

function resetMockFrom() {
  mockFrom.mockReset()
  mockFrom.mockReturnValue(mockChain)
  mockRpc.mockReset()
  mockRpc.mockResolvedValue({ data: { id: 'rpc-result-id' }, error: null })
}

function resetAll() {
  resetChain()
  resetMockFrom()
}

// ---------------------------------------------------------------------------
// Глобальные моки модулей
// ---------------------------------------------------------------------------

vi.mock('../utils/supabase', () => ({
  getServerSupabase: () => mockClient,
  getAuthSupabase: () => mockClient,
  mapOrder: (row: any) => row,
  mapCustomer: (row: any) => row,
  mapCustomerAddress: (row: any) => row,
  mapCombo: (row: any) => row,
  mapDish: (row: any) => row,
  mapTenant: (row: any) => row,
}))

vi.mock('../utils/customerAuth', () => ({
  getAuthenticatedCustomerId: vi.fn().mockResolvedValue('customer-id-1'),
  getAuthenticatedContext: vi.fn().mockResolvedValue({
    customerId: 'customer-id-1',
    supabase: mockClient,
  }),
  getAuthenticatedContextWithCustomer: vi.fn().mockResolvedValue(null),
}))

vi.mock('~/shared/utils/reportError', () => ({ reportError: vi.fn() }))

// Nuxt auto-imports которые используются в server/api/* без explicit import
;(globalThis as any).createError = createError
;(globalThis as any).defineEventHandler = (fn: Function) => fn
;(globalThis as any).getQuery = getQuery
;(globalThis as any).getRouterParam = getRouterParam
;(globalThis as any).getCookie = getCookie
;(globalThis as any).deleteCookie = vi.fn()
;(globalThis as any).getRequestHeader = vi.fn().mockReturnValue(undefined)
;(globalThis as any).readBody = vi.fn()
;(globalThis as any).useRuntimeConfig = () => ({
  public: { supabaseUrl: 'http://localhost', supabaseAnonKey: 'anon' },
  supabaseServiceRoleKey: 'service',
})

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------

function makeEvent(tenantId: string, extra: Record<string, any> = {}) {
  return {
    context: { tenantId, ...extra.context },
    headers: new Headers(),
    node: { req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } }, res: {} },
    ...extra,
  } as any
}

// ---------------------------------------------------------------------------
// A. getTenantDb — базовый guard и авто-фильтр
// ---------------------------------------------------------------------------

describe('getTenantDb — cross-tenant isolation', () => {
  beforeEach(resetAll)

  it('бросает 400 если tenantId отсутствует в event.context', async () => {
    const { getTenantDb } = await import('../utils/tenantDb')
    const event = { context: {} } as any

    let caught: any
    try {
      getTenantDb(event)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(400)
  })

  it('from() всегда применяет tenant_id фильтр', async () => {
    const { getTenantDb } = await import('../utils/tenantDb')

    const db = getTenantDb(makeEvent('tenant-123'))
    db.from('orders').select('*')

    expect(mockFrom).toHaveBeenCalledWith('orders')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123')
  })

  it('junction() НЕ применяет tenant_id фильтр', async () => {
    const { getTenantDb } = await import('../utils/tenantDb')

    const db = getTenantDb(makeEvent('tenant-123'))
    db.junction('service_resources')

    expect(mockFrom).toHaveBeenCalledWith('service_resources')
    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', expect.anything())
  })

  it('запрос через tenant-A не применяет tenant-B фильтр', async () => {
    const { getTenantDb } = await import('../utils/tenantDb')

    const db = getTenantDb(makeEvent('tenant-A'))
    db.from('orders').select('*')

    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', 'tenant-B')
  })
})

// ---------------------------------------------------------------------------
// B. customer/orders.get.ts — проверяем tenant_id фильтр
// ---------------------------------------------------------------------------

describe('GET /api/customer/orders — tenant isolation', () => {
  beforeEach(resetAll)

  it('применяет .eq("tenant_id", tenantId) при запросе заказов', async () => {
    mockChain.range.mockResolvedValue({ data: [], error: null, count: 0 })

    const mod = await import('../api/customer/orders.get')
    const handler = mod.default as Function
    const event = makeEvent('tenant-A')

    await handler(event)

    expect(mockFrom).toHaveBeenCalledWith('orders')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('НЕ применяет tenant_id фильтр другого тенанта', async () => {
    mockChain.range.mockResolvedValue({ data: [], error: null, count: 0 })

    const mod = await import('../api/customer/orders.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', 'tenant-B')
  })

  it('данные другого тенанта не попадают в ответ', async () => {
    const tenantAOrders = [
      { id: 'order-A-1', tenant_id: 'tenant-A', status: null, order_items: [] },
    ]
    mockChain.range.mockResolvedValue({ data: tenantAOrders, error: null, count: 1 })
    mockChain.in.mockResolvedValue({ data: [], error: null })

    const mod = await import('../api/customer/orders.get')
    const handler = mod.default as Function
    const result = await handler(makeEvent('tenant-A')) as any

    expect(result.orders).toBeDefined()
    const tenantBOrders = (result.orders as any[]).filter((o: any) => o.tenant_id === 'tenant-B')
    expect(tenantBOrders).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// C. customer/profile.get.ts — tenant_id проверка через прямой supabase вызов
// ---------------------------------------------------------------------------

describe('GET /api/customer/profile — tenant isolation', () => {
  beforeEach(resetAll)

  it('применяет .eq("tenant_id", tenantId) при запросе профиля', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'customer-id-1', tenant_id: 'tenant-A',
        name: 'Test', phone: null, email: null,
        auth_user_id: null, telegram_id: null, avatar_url: null, created_at: '',
      },
      error: null,
    })

    const mod = await import('../api/customer/profile.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    // profile.get.ts вручную добавляет .eq('tenant_id', tenantId) — проверяем
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('не запрашивает профиль с tenant_id другого тенанта', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'customer-id-1', tenant_id: 'tenant-A',
        name: 'Test', phone: null, email: null,
        auth_user_id: null, telegram_id: null, avatar_url: null, created_at: '',
      },
      error: null,
    })

    const mod = await import('../api/customer/profile.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', 'tenant-B')
  })

  it('бросает 404 если профиль не найден (maybeSingle вернул null)', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    const mod = await import('../api/customer/profile.get')
    const handler = mod.default as Function

    let caught: any
    try {
      await handler(makeEvent('tenant-A'))
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// D. promo/[id].get.ts — tenant_id через getTenantDb
// ---------------------------------------------------------------------------

describe('GET /api/promo/[id] — tenant isolation', () => {
  beforeEach(resetAll)

  it('применяет .eq("tenant_id", tenantId) при запросе баннера', async () => {
    const bannerData = {
      id: 'banner-1', url: 'http://img', content: 'text',
      enabled: true, promotion_id: 'promo-1', promo_code_id: null,
    }
    const promoData = { title: 'Скидка 20%', active: true, deleted_at: null }

    mockChain.single
      .mockResolvedValueOnce({ data: bannerData, error: null })
      .mockResolvedValueOnce({ data: promoData, error: null })

    const mod = await import('../api/promo/[id].get')
    const handler = mod.default as Function

    await handler(makeEvent('tenant-A', { context: { tenantId: 'tenant-A', params: { id: 'banner-1' } } }))

    expect(mockFrom).toHaveBeenCalledWith('banners')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('НЕ применяет tenant_id другого тенанта', async () => {
    const bannerData = {
      id: 'banner-1', url: null, content: 'text',
      enabled: true, promotion_id: null, promo_code_id: null,
    }
    mockChain.single.mockResolvedValue({ data: bannerData, error: null })

    const mod = await import('../api/promo/[id].get')
    const handler = mod.default as Function

    await handler(makeEvent('tenant-A', { context: { tenantId: 'tenant-A', params: { id: 'banner-1' } } }))

    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', 'tenant-B')
  })

  it('бросает 404 если баннер disabled (enabled = false)', async () => {
    // getTenantDb фильтрует по tenant_id — баннер нашёлся, но disabled
    const bannerData = {
      id: 'banner-1', url: null, content: '',
      enabled: false, promotion_id: null, promo_code_id: null,
    }
    mockChain.single.mockResolvedValue({ data: bannerData, error: null })

    const mod = await import('../api/promo/[id].get')
    const handler = mod.default as Function

    let caught: any
    try {
      await handler(makeEvent('tenant-A', { context: { tenantId: 'tenant-A', params: { id: 'banner-1' } } }))
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(404)
  })

  it('бросает 404 если id не передан', async () => {
    const mod = await import('../api/promo/[id].get')
    const handler = mod.default as Function

    let caught: any
    try {
      await handler(makeEvent('tenant-A', { context: { tenantId: 'tenant-A', params: {} } }))
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// E. Регрессионный тест: прямой запрос без getTenantDb — нет изоляции
// ---------------------------------------------------------------------------

describe('Регрессия: без getTenantDb нет tenant-изоляции', () => {
  beforeEach(resetAll)

  it('прямой sb.from() без eq(tenant_id) не защищён от cross-tenant', () => {
    // Симулируем что будет если убрать getTenantDb и сделать прямой запрос
    const leakyQuery = () => mockClient.from('orders').select('*')
    leakyQuery()

    // from() вызван — но eq('tenant_id', ...) НЕ вызван!
    // Это дыра. getTenantDb обязателен.
    expect(mockFrom).toHaveBeenCalledWith('orders')
    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', expect.anything())
  })

  it('getTenantDb.from() в отличие от прямого запроса всегда фильтрует по tenantId', async () => {
    const { getTenantDb } = await import('../utils/tenantDb')

    const db = getTenantDb(makeEvent('tenant-safe'))
    db.from('orders').select('*')

    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-safe')
  })
})

// ---------------------------------------------------------------------------
// F. appointments/settings.get.ts — tenant_id через getTenantDb
// ---------------------------------------------------------------------------

describe('GET /api/appointments/settings — tenant isolation', () => {
  beforeEach(resetAll)

  it('применяет tenant_id фильтр при запросе настроек', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const mod = await import('../api/appointments/settings.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    expect(mockFrom).toHaveBeenCalledWith('appointment_settings')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('НЕ применяет tenant_id другого тенанта', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const mod = await import('../api/appointments/settings.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', 'tenant-B')
  })

  it('возвращает дефолты если настройки не найдены (data = null)', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const mod = await import('../api/appointments/settings.get')
    const handler = mod.default as Function
    const result = await handler(makeEvent('tenant-A'))

    expect(result).toMatchObject({ autoConfirm: false, slotStepMinutes: 30, bookingHorizonDays: 30 })
  })
})

// ---------------------------------------------------------------------------
// G. appointments/services.get.ts — tenant_id через getTenantDb
// ---------------------------------------------------------------------------

describe('GET /api/appointments/services — tenant isolation', () => {
  beforeEach(resetAll)

  it('применяет tenant_id фильтр при запросе услуг', async () => {
    // tenants single() → services enabled
    mockChain.single.mockResolvedValueOnce({ data: { modules: { services: true } }, error: null })

    const mod = await import('../api/appointments/services.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    expect(mockFrom).toHaveBeenCalledWith('services')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('бросает 400 если модуль services выключен', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { modules: {} }, error: null })

    const mod = await import('../api/appointments/services.get')
    const handler = mod.default as Function

    let caught: any
    try {
      await handler(makeEvent('tenant-A'))
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(400)
  })

  it('НЕ применяет tenant_id другого тенанта', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { modules: { services: true } }, error: null })

    const mod = await import('../api/appointments/services.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', 'tenant-B')
  })
})

// ---------------------------------------------------------------------------
// H. appointments/resources.get.ts — tenant_id через getTenantDb
// ---------------------------------------------------------------------------

describe('GET /api/appointments/resources — tenant isolation', () => {
  beforeEach(resetAll)

  it('применяет tenant_id фильтр при загрузке услуги и настроек', async () => {
    // tenants.single()
    mockChain.single.mockResolvedValueOnce({ data: { modules: { services: true } }, error: null })
    // appointment_settings.maybeSingle() + services.maybeSingle() (в Promise.all)
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { staff_name_format: 'full_name' }, error: null })
      .mockResolvedValueOnce({ data: { allow_resource_choice: true, category_id: null }, error: null })

    const mod = await import('../api/appointments/resources.get')
    const handler = mod.default as Function
    const event = makeEvent('tenant-A', { context: { tenantId: 'tenant-A' } })
    ;(globalThis as any).getQuery = vi.fn().mockReturnValue({ serviceId: 'svc-1' })

    await handler(event)

    // Услуга запрашивается через getTenantDb → tenant filter обязателен
    expect(mockFrom).toHaveBeenCalledWith('services')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
    // Junction-таблица без tenant_id — запрашивается без фильтра (намеренно)
    expect(mockFrom).toHaveBeenCalledWith('service_resources')
    ;(globalThis as any).getQuery = getQuery
  })

  it('бросает 400 если serviceId не передан', async () => {
    ;(globalThis as any).getQuery = vi.fn().mockReturnValue({})

    const mod = await import('../api/appointments/resources.get')
    const handler = mod.default as Function

    let caught: any
    try {
      await handler(makeEvent('tenant-A'))
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(400)
    ;(globalThis as any).getQuery = getQuery
  })

  it('бросает 404 если услуга не принадлежит тенанту', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { modules: { services: true } }, error: null })
    // settings ok, service not found (null)
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { staff_name_format: 'full_name' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    ;(globalThis as any).getQuery = vi.fn().mockReturnValue({ serviceId: 'foreign-svc' })

    const mod = await import('../api/appointments/resources.get')
    const handler = mod.default as Function

    let caught: any
    try {
      await handler(makeEvent('tenant-A'))
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(404)
    ;(globalThis as any).getQuery = getQuery
  })
})

// ---------------------------------------------------------------------------
// I. appointments/request.post.ts — tenant_id через getTenantDb
// ---------------------------------------------------------------------------

describe('POST /api/appointments/request — tenant isolation', () => {
  beforeEach(() => {
    resetAll()
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
      customerName: 'Анна',
      customerPhone: '+79001234567',
      services: [{ serviceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }],
    })
  })

  it('применяет tenant_id фильтр при загрузке услуг', async () => {
    // services query
    mockChain.in.mockResolvedValueOnce({
      data: [{ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Стрижка', duration: 60, price: 1000, is_bookable: true }],
      error: null,
    })

    const mod = await import('../api/appointments/request.post')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    expect(mockFrom).toHaveBeenCalledWith('services')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('бросает 400 если услуга не найдена в тенанте (cross-tenant guard)', async () => {
    // services query возвращает пустой массив — services чужого тенанта не в списке
    mockChain.in.mockResolvedValueOnce({ data: [], error: null })

    const mod = await import('../api/appointments/request.post')
    const handler = mod.default as Function

    let caught: any
    try {
      await handler(makeEvent('tenant-A'))
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(400)
  })

  it('НЕ применяет tenant_id другого тенанта', async () => {
    mockChain.in.mockResolvedValueOnce({
      data: [{ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Стрижка', duration: 60, price: 1000, is_bookable: true }],
      error: null,
    })

    const mod = await import('../api/appointments/request.post')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', 'tenant-B')
  })
})

// ---------------------------------------------------------------------------
// J. orders/[id].get.ts — branchInfo через db.raw.from('branches') (Proxy auto-tenant)
// ---------------------------------------------------------------------------

describe('GET /api/orders/[id] — tenant isolation', () => {
  beforeEach(resetAll)
  afterEach(() => {
    ;(globalThis as any).getRouterParam = getRouterParam
  })

  it('применяет tenant_id фильтр на orders + branches (через Proxy)', async () => {
    // orders.maybeSingle() — customer_id matches mocked getAuthenticatedContext customerId
    // (см. vi.mock('../utils/customerAuth') в начале файла), чтобы IDOR guard пропустил
    mockChain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'order-1', tenant_id: 'tenant-A', branch_id: 'branch-1', status: null, order_items: [], customer_id: 'customer-id-1', guest_token: null },
        error: null,
      })
      // branches.maybeSingle() через db.raw
      .mockResolvedValueOnce({ data: { address: 'ул. Пушкина 1' }, error: null })

    ;(globalThis as any).getRouterParam = vi.fn().mockReturnValue('order-1')

    const mod = await import('../api/orders/[id].get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    // orders.from()
    expect(mockFrom).toHaveBeenCalledWith('orders')
    // branches.from() через db.raw — Proxy должен автоинжектить tenant_id
    expect(mockFrom).toHaveBeenCalledWith('branches')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('бросает 404 если заказа нет в тенанте', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    ;(globalThis as any).getRouterParam = vi.fn().mockReturnValue('foreign-order')

    const mod = await import('../api/orders/[id].get')
    const handler = mod.default as Function

    let caught: any
    try {
      await handler(makeEvent('tenant-A'))
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// K. branches.get.ts — публичный список филиалов
// ---------------------------------------------------------------------------

describe('GET /api/branches — tenant isolation', () => {
  beforeEach(resetAll)

  it('применяет tenant_id фильтр при запросе филиалов', async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null })

    const mod = await import('../api/branches.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A', { context: { tenantId: 'tenant-A', tenant: { contacts: {}, workingHoursSchedule: null } } }))

    expect(mockFrom).toHaveBeenCalledWith('branches')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('НЕ применяет tenant_id другого тенанта', async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null })

    const mod = await import('../api/branches.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A', { context: { tenantId: 'tenant-A', tenant: { contacts: {}, workingHoursSchedule: null } } }))

    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', 'tenant-B')
  })
})

// ---------------------------------------------------------------------------
// L. menu.get.ts — каталог блюд/категорий/комбо
// ---------------------------------------------------------------------------

describe('GET /api/menu — tenant isolation', () => {
  beforeEach(resetAll)

  it('применяет tenant_id фильтр на categories/dishes/combos', async () => {
    // три параллельных запроса в Promise.all возвращают пустые data
    mockChain.order.mockResolvedValue({ data: [], error: null })

    const mod = await import('../api/menu.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A', {
      context: { tenantId: 'tenant-A', tenant: { modules: { combos: false, modifiers: false, addons: false }, dishTags: [] } },
    }))

    expect(mockFrom).toHaveBeenCalledWith('categories')
    expect(mockFrom).toHaveBeenCalledWith('dishes')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('НЕ применяет tenant_id другого тенанта на основных таблицах', async () => {
    mockChain.order.mockResolvedValue({ data: [], error: null })

    const mod = await import('../api/menu.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A', {
      context: { tenantId: 'tenant-A', tenant: { modules: { combos: false, modifiers: false, addons: false }, dishTags: [] } },
    }))

    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', 'tenant-B')
  })
})

// ---------------------------------------------------------------------------
// M. customer/addresses/index.get.ts — фильтр по customer_id (без tenant_id)
// ---------------------------------------------------------------------------

describe('GET /api/customer/addresses — customer_id isolation', () => {
  beforeEach(resetAll)

  it('фильтрует по customer_id (tenant gated через customerAuth)', async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null })

    const mod = await import('../api/customer/addresses/index.get')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    expect(mockFrom).toHaveBeenCalledWith('customer_addresses')
    // customer_id из мока = 'customer-id-1'
    expect(mockChain.eq).toHaveBeenCalledWith('customer_id', 'customer-id-1')
  })
})

// ---------------------------------------------------------------------------
// N. customer/addresses/[id].patch.ts — UPDATE с двойным фильтром
// ---------------------------------------------------------------------------

describe('PATCH /api/customer/addresses/[id] — customer_id isolation', () => {
  beforeEach(() => {
    resetAll()
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ label: 'Дом' })
    ;(globalThis as any).getRouterParam = vi.fn().mockReturnValue('addr-1')
  })

  afterEach(() => {
    ;(globalThis as any).getRouterParam = getRouterParam
  })

  it('требует совпадения address.id И customer_id', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { id: 'addr-1' }, error: null })

    const mod = await import('../api/customer/addresses/[id].patch')
    const handler = mod.default as Function
    await handler(makeEvent('tenant-A'))

    expect(mockFrom).toHaveBeenCalledWith('customer_addresses')
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'addr-1')
    expect(mockChain.eq).toHaveBeenCalledWith('customer_id', 'customer-id-1')
  })

  it('бросает 404 если адрес не найден или принадлежит другому customer', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'No rows' } })

    const mod = await import('../api/customer/addresses/[id].patch')
    const handler = mod.default as Function

    let caught: any
    try {
      await handler(makeEvent('tenant-A'))
    } catch (e) {
      caught = e
    }
    expect(caught.statusCode).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// O. db.raw — Proxy инжектит tenant_id для tenant-таблиц
// ---------------------------------------------------------------------------

describe('db.raw — Proxy автозащита tenant-таблиц', () => {
  beforeEach(resetAll)

  it('db.raw.from(<tenant-таблица>) автоматически инжектит tenant_id', async () => {
    const { getTenantDb } = await import('../utils/tenantDb')
    const db = getTenantDb(makeEvent('tenant-A'))

    db.raw.from('branches').select('address').eq('id', 'b-1')

    expect(mockFrom).toHaveBeenCalledWith('branches')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('db.raw.from(<unknown>) НЕ инжектит tenant_id (pass-through)', async () => {
    const { getTenantDb } = await import('../utils/tenantDb')
    const db = getTenantDb(makeEvent('tenant-A'))

    db.raw.from('totally_unknown_table').select('*')

    expect(mockFrom).toHaveBeenCalledWith('totally_unknown_table')
    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', expect.anything())
  })

  it('db.raw.from(<tenant-таблица>).insert() требует переключиться на crossTenant', async () => {
    const { getTenantDb } = await import('../utils/tenantDb')
    const db = getTenantDb(makeEvent('tenant-A'))

    expect(() => db.raw.from('branches').insert({ name: 'x' })).toThrow(/crossTenant/)
  })

  it('db.crossTenant.from(<tenant-таблица>) НЕ инжектит — escape hatch для умышленного cross-tenant', async () => {
    const { getTenantDb } = await import('../utils/tenantDb')
    const db = getTenantDb(makeEvent('tenant-A'))

    db.crossTenant.from('branches').select('*')

    expect(mockFrom).toHaveBeenCalledWith('branches')
    expect(mockChain.eq).not.toHaveBeenCalledWith('tenant_id', expect.anything())
  })
})

// ---------------------------------------------------------------------------
// P. order-items.ts — combos фильтруются по tenant_id (фикс 2026-05-04)
// ---------------------------------------------------------------------------

describe('order-items.ts — combos cross-tenant защита', () => {
  beforeEach(resetAll)
  // ВАЖНО: порядок mockResolvedValueOnce ниже совпадает с порядком запросов в
  // `validateAndBuildItems` (apps/storefront/server/services/order-items.ts):
  //   1) dishes.in (Promise.all #1)
  //   2) dish_modifier_options.in (Promise.all #2)
  //   3) dish_addons.in (Promise.all #3)
  //   4) combo_items chain → .order (если есть combos)
  //   5) combos.in (Promise.all #2 второго блока)
  // Если поменяется порядок Promise.all — тесты упадут, обновить сюда параллельно.

  it('combos подгружаются с .eq("tenant_id", tenantId)', async () => {
    // dishes / dish_modifier_options / dish_addons — пустые
    mockChain.in
      .mockResolvedValueOnce({ data: [], error: null })  // dishes
      .mockResolvedValueOnce({ data: [], error: null })  // dish_modifier_options
      .mockResolvedValueOnce({ data: [], error: null })  // dish_addons
      .mockReturnValueOnce(mockChain)  // combo_items chain (.order)
      .mockResolvedValueOnce({ data: [{ id: 'combo-1', price: 500 }], error: null })  // combos

    mockChain.order.mockResolvedValueOnce({ data: [], error: null })  // combo_items.order

    const { validateAndBuildItems } = await import('../services/order-items')
    await validateAndBuildItems(mockClient as any, 'tenant-A', [
      { dishId: null, comboId: 'combo-1', dishName: 'Сет', quantity: 1, removedIngredients: [] },
    ])

    expect(mockFrom).toHaveBeenCalledWith('combos')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('бросает 400 если combo не принадлежит тенанту (length mismatch)', async () => {
    mockChain.in
      .mockResolvedValueOnce({ data: [], error: null })  // dishes
      .mockResolvedValueOnce({ data: [], error: null })  // dish_modifier_options
      .mockResolvedValueOnce({ data: [], error: null })  // dish_addons
      .mockReturnValueOnce(mockChain)  // combo_items chain
      .mockResolvedValueOnce({ data: [], error: null })  // combos — пустой массив (foreign tenant)

    mockChain.order.mockResolvedValueOnce({ data: [], error: null })

    const { validateAndBuildItems } = await import('../services/order-items')

    let caught: any
    try {
      await validateAndBuildItems(mockClient as any, 'tenant-A', [
        { dishId: null, comboId: 'foreign-combo', dishName: 'Чужой сет', quantity: 1, removedIngredients: [] },
      ])
    } catch (e) {
      caught = e
    }
    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(400)
    expect(caught.message).toMatch(/комбо/i)
  })

  it('dishes фильтруются по tenant_id', async () => {
    mockChain.in
      .mockResolvedValueOnce({ data: [{ id: 'dish-1', price: 200, active: true, tenant_id: 'tenant-A' }], error: null })  // dishes
      .mockResolvedValueOnce({ data: [], error: null })  // dish_modifier_options
      .mockResolvedValueOnce({ data: [], error: null })  // dish_addons

    const { validateAndBuildItems } = await import('../services/order-items')
    await validateAndBuildItems(mockClient as any, 'tenant-A', [
      { dishId: 'dish-1', dishName: 'Бургер', quantity: 1, removedIngredients: [] },
    ])

    expect(mockFrom).toHaveBeenCalledWith('dishes')
    expect(mockChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A')
  })

  it('бросает 500 если supabase вернул error на combos (не молча отдаёт price=0)', async () => {
    mockChain.in
      .mockResolvedValueOnce({ data: [], error: null })  // dishes
      .mockResolvedValueOnce({ data: [], error: null })  // dish_modifier_options
      .mockResolvedValueOnce({ data: [], error: null })  // dish_addons
      .mockReturnValueOnce(mockChain)  // combo_items chain
      .mockResolvedValueOnce({ data: null, error: { message: 'connection lost' } })  // combos — error

    mockChain.order.mockResolvedValueOnce({ data: [], error: null })

    const { validateAndBuildItems } = await import('../services/order-items')

    let caught: any
    try {
      await validateAndBuildItems(mockClient as any, 'tenant-A', [
        { dishId: null, comboId: 'combo-1', dishName: 'Сет', quantity: 1, removedIngredients: [] },
      ])
    } catch (e) {
      caught = e
    }
    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(500)
  })
})
