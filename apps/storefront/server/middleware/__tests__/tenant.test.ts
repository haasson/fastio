/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError, getQuery } from 'h3'

// ---------------------------------------------------------------------------
// Nuxt auto-imports — tenant.ts использует их без explicit import
// ---------------------------------------------------------------------------

// createError встраивается в globalThis, как и в остальных storefront-тестах
// (enforceRateLimit.test.ts, cross-tenant.test.ts).
;(globalThis as any).createError = (opts: { statusCode: number; message?: string }) => {
  const err = new Error(opts.message ?? String(opts.statusCode)) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}

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

// ---------------------------------------------------------------------------
// Мокаем зависимости middleware
// ---------------------------------------------------------------------------

const mockLookupTenantByHost = vi.fn()
const mockGetServerSupabase = vi.fn().mockReturnValue({})
const mockMapTenant = vi.fn((x: any) => x)
const mockReportError = vi.fn()

vi.mock('../utils/supabase', () => ({
  getServerSupabase: () => mockGetServerSupabase(),
  mapTenant: (row: any) => mockMapTenant(row),
}))

vi.mock('../utils/tenantCache', () => ({
  lookupTenantByHost: (...args: any[]) => mockLookupTenantByHost(...args),
}))

vi.mock('@fastio/shared/observability', () => ({
  reportError: (err: unknown) => mockReportError(err),
}))

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------

function makeEvent(hostHeader?: string) {
  const event: any = {
    context: {},
    node: { req: { headers: {} }, res: {} },
  }

  // Настраиваем getRequestHeader: возвращает hostHeader для 'x-original-host',
  // undefined для остальных (чтобы middleware взял getRequestHost).
  ;(globalThis as any).getRequestHeader = vi.fn((ev: any, name: string) => {
    if (name === 'x-original-host') return hostHeader
    return undefined
  })

  // getRequestHost: fallback когда x-original-host undefined/empty.
  ;(globalThis as any).getRequestHost = vi.fn().mockReturnValue(hostHeader ?? '')

  return event
}

// ---------------------------------------------------------------------------
// Импортируем SUT после установки globalThis-mock'ов
// ---------------------------------------------------------------------------

const tenantHandler = (await import('../tenant')).default as Function

// ---------------------------------------------------------------------------
// Тесты
// ---------------------------------------------------------------------------

describe('storefront tenant middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSupabase.mockReturnValue({})
    mockMapTenant.mockImplementation((x: any) => x)
    // Сбрасываем getRequestURL на non-special pathname
    ;(globalThis as any).getRequestURL = vi.fn().mockReturnValue(new URL('http://example.com/'))
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
    // lookupTenantByHost возвращает null-тенант (тенант не найден)
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
    }
    const event = makeEvent('demo.fastio.ru')
    // lookupTenantByHost возвращает тенант из кэша
    mockLookupTenantByHost.mockResolvedValue({ tenant: fakeTenant, source: 'cache' })

    // При cache-hit middleware зовёт mergeFreshSubscription через supabase —
    // мокаем supabase.from().select().eq().maybeSingle()
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { subscription: { status: 'active' } }, error: null })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockFromFn = vi.fn().mockReturnValue({ select: mockSelect })
    mockGetServerSupabase.mockReturnValue({ from: mockFromFn })

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
