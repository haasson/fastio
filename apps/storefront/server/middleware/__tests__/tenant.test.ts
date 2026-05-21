/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError, getQuery } from 'h3'

// ---------------------------------------------------------------------------
// Nuxt auto-imports — tenant.ts использует их без explicit import
// ---------------------------------------------------------------------------

// createError встраивается в globalThis, как и в остальных storefront-тестах
// (enforceRateLimit.test.ts, cross-tenant.test.ts). Используем реальный createError из h3
// (он создаёт H3Error с .statusCode), чтобы код, проверяющий statusCode, работал.
;(globalThis as any).createError = createError

// defineEventHandler в Nuxt просто оборачивает callback — в тестах возвращаем его напрямую.
;(globalThis as any).defineEventHandler = (fn: Function) => fn

// getRequestURL — нужен, чтобы middleware не упал на pathname-проверках.
// Возвращаем URL без специальных pathname-префиксов, чтобы middleware не делал early return.
;(globalThis as any).getRequestURL = vi.fn().mockReturnValue(new URL('http://example.com/'))

// getRequestHeader — переопределяется в каждом тесте для Host/x-original-host.
;(globalThis as any).getRequestHeader = vi.fn().mockReturnValue(undefined)

// getRequestHost — fallback когда x-original-host не задан.
;(globalThis as any).getRequestHost = vi.fn().mockReturnValue('')

// getQuery — используется в devFallbackOrThrow (import.meta.dev ветка, в тестах не активна).
;(globalThis as any).getQuery = getQuery

// useRuntimeConfig — нужен для загрузки модуля supabase.ts (даже при мокировании)
;(globalThis as any).useRuntimeConfig = () => ({
  public: { supabaseUrl: 'http://localhost:54321', supabaseAnonKey: 'anon' },
  supabaseServiceRoleKey: 'service-key',
})

// ---------------------------------------------------------------------------
// Мокаем зависимости middleware.
// Примечание: пути vi.mock() резолвятся относительно ТЕСТ-файла (middleware/__tests__/).
// tenant.ts находится в middleware/ и импортирует из ../utils/*, что резолвится в server/utils/*.
// Из test-файла нам нужно мокировать server/utils/*, т.е. ../../utils/* (два уровня вверх).
// ---------------------------------------------------------------------------

const mockLookupTenantByHost = vi.fn()
const mockGetServerSupabase = vi.fn()
const mockMapTenant = vi.fn((x: any) => x)
const mockReportError = vi.fn()

vi.mock('../../utils/supabase', () => ({
  getServerSupabase: () => mockGetServerSupabase(),
  mapTenant: (row: any) => mockMapTenant(row),
}))

vi.mock('../../utils/tenantCache', () => ({
  lookupTenantByHost: (...args: any[]) => mockLookupTenantByHost(...args),
}))

vi.mock('@fastio/shared/observability', () => ({
  reportError: (err: unknown) => mockReportError(err),
}))

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------

/**
 * Создаёт фейковый H3Event с нужным Host header.
 * getRequestHeader и getRequestHost выставляются как глобальные mock-функции,
 * т.к. middleware обращается к ним как к Nuxt auto-imports (не через import).
 */
function makeEvent(hostHeader?: string) {
  const event: any = {
    context: {},
    node: { req: { headers: {} }, res: {} },
  }

  ;(globalThis as any).getRequestHeader = vi.fn((ev: any, name: string) => {
    if (name === 'x-original-host') return hostHeader
    return undefined
  })

  ;(globalThis as any).getRequestHost = vi.fn().mockReturnValue(hostHeader ?? '')

  return event
}

// ---------------------------------------------------------------------------
// Импортируем SUT после установки globalThis-mock'ов и vi.mock() деклараций
// ---------------------------------------------------------------------------

const tenantHandler = (await import('../tenant')).default as Function

// ---------------------------------------------------------------------------
// Тесты
// ---------------------------------------------------------------------------

describe('storefront tenant middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Сбрасываем getRequestURL на non-special pathname после clearAllMocks
    ;(globalThis as any).getRequestURL = vi.fn().mockReturnValue(new URL('http://example.com/'))
    // Восстанавливаем стаб supabase клиента
    mockGetServerSupabase.mockReturnValue({})
    mockMapTenant.mockImplementation((x: any) => x)
  })

  it('пустой Host header → 503 с message "Missing or invalid Host header"', async () => {
    const event = makeEvent('')

    let caught: any
    try {
      await tenantHandler(event)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(503)
    expect(caught.message).toBe('Missing or invalid Host header')
  })

  it('неизвестный тенант → 503 с message "Tenant not found"', async () => {
    const event = makeEvent('unknown.example.com')
    // lookupTenantByHost возвращает null-тенант (тенант не найден в БД)
    mockLookupTenantByHost.mockResolvedValue({ tenant: null, source: 'fresh' })

    let caught: any
    try {
      await tenantHandler(event)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.statusCode).toBe(503)
    expect(caught.message).toBe('Tenant not found')
  })

  it('найденный тенант → нет throw, event.context.tenantId установлен', async () => {
    const fakeTenant = {
      id: 'tenant-123',
      slug: 'demo',
      subscription: { status: 'active' },
      modules: { delivery: false, pickup: true },
      deliveryMode: 'disabled',
      deliveryAvailable: false,
      orderingEnabled: true,
    }
    const event = makeEvent('demo.fastio.ru')
    // source: 'fresh' — subscription не надо перечитывать (не cache-hit)
    mockLookupTenantByHost.mockResolvedValue({ tenant: fakeTenant, source: 'fresh' })

    let threw = false
    try {
      await tenantHandler(event)
    } catch {
      threw = true
    }

    expect(threw).toBe(false)
    expect(event.context.tenantId).toBe('tenant-123')
  })
})
