/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type */

/**
 * Тесты POST /api/appointments/bulk — endpoint групповой записи.
 *
 * Покрывает: валидацию body, rate-limit, модульные/тенант checks, branch-фильтр,
 * service.is_bookable, autoConfirm → status='confirmed', RPC error mapping.
 *
 * НЕ покрывает (отдельные итерации):
 *  - round-robin auto-pick: требует много DB-цепочек, заслуживает свой набор тестов
 *  - capacity на сервере: проверяется через RPC (нужна БД)
 *  - atomicity bulk: то же
 *  - DST переходы в localDateTimeToUtcIso: shared утилита
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError } from 'h3'

import type { BulkPayload } from '../api/appointments/bulk.post'

// ──────────────────────────────────────────────────────────────────────────
// Mock infra
//
// `await import('../api/appointments/bulk.post')` кешируется vitest'ом — между
// тестами импортируется один и тот же handler. Это безопасно, потому что
// handler резолвит все depencies (readBody, getClientIp, getTenantDb, ...) в
// runtime внутри defineEventHandler-колбэка, а не на module-init. Поэтому
// пере-настройка vi.fn / globalThis между тестами действительно влияет на
// поведение. Если в bulk.post.ts появится top-level capture зависимости —
// нужно будет добавить vi.resetModules() в beforeEach.
// ──────────────────────────────────────────────────────────────────────────

const mockReadBody = vi.fn()
let currentRemoteAddress = '127.0.0.1'
const mockRpc = vi.fn()
const mockGetAuthCustomer = vi.fn()

// Per-table chain-mocks. Каждый buildChainFor возвращает «терминатор» с заранее
// настроенными resolve-значениями. Хелперы scenario(...) задают, что вернёт
// каждый запрос в конкретном тесте. Не используем общий mockChain как в
// cross-tenant.test, потому что bulk.post.ts делает 5+ цепочек подряд и
// настройка через mockResolvedValueOnce становится хрупкой.

type Resolved = { data: any; error: any }
type ResolverValue = Resolved | (() => Resolved) | Resolved[]

let resolvers: Map<string, ResolverValue> = new Map()
let resolverCallIdx: Map<string, number> = new Map()

function setResolver(key: string, value: ResolverValue) {
  resolvers.set(key, value)
}

function getResolver(key: string): Resolved {
  const r = resolvers.get(key)
  if (!r) return { data: null, error: null }
  if (Array.isArray(r)) {
    // Sequential: при N-м вызове отдаём r[N], после конца зацикливаемся на последнем.
    const idx = resolverCallIdx.get(key) ?? 0
    resolverCallIdx.set(key, idx + 1)
    return r[Math.min(idx, r.length - 1)]
  }
  return typeof r === 'function' ? r() : r
}

function buildThenable(key: string) {
  // Минимальная имитация PostgREST-chain: любой метод возвращает self,
  // .then() резолвит с заранее настроенным значением.
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: (v: Resolved) => unknown) => resolve(getResolver(key))
      }
      // Для .single()/.maybeSingle() возвращаем «реальный» Promise.
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => Promise.resolve(getResolver(key))
      }
      // Любой другой метод-link — возвращаем сам proxy (для chain-style).
      return () => proxy
    },
  }
  const proxy: any = new Proxy({}, handler)
  return proxy
}

// ──────────────────────────────────────────────────────────────────────────
// vi.mock — модули которые handler импортирует
// ──────────────────────────────────────────────────────────────────────────

vi.mock('../utils/tenantDb', () => ({
  getTenantDb: vi.fn(() => ({
    tenantId: 'tenant-A',
    from: (table: string) => buildThenable(`from:${table}`),
    junction: (table: string) => buildThenable(`junction:${table}`),
    raw: {
      rpc: (...args: unknown[]) => mockRpc(...args),
    },
  })),
}))

vi.mock('../utils/customerAuth', () => ({
  getAuthenticatedContextWithCustomer: (...args: unknown[]) => mockGetAuthCustomer(...args),
}))

vi.mock('~/shared/utils/reportError', () => ({ reportError: vi.fn() }))

// Nuxt globals
;(globalThis as any).createError = createError
;(globalThis as any).defineEventHandler = (fn: Function) => fn
;(globalThis as any).readBody = (...args: unknown[]) => mockReadBody(...args)
;(globalThis as any).getRequestHeader = vi.fn().mockReturnValue(undefined)

// ──────────────────────────────────────────────────────────────────────────
// Хелпер: установить «здоровые» дефолты для всех DB-вызовов на happy path
// (ни один не блокирует, RPC возвращает успех).
// ──────────────────────────────────────────────────────────────────────────

// Дата +5 дней от сегодня — внутри дефолтного booking_horizon_days=30, но в будущем.
// Не статика, потому что иначе через год тесты разъедутся с реальной датой.
function todayPlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
const FUTURE_DATE = todayPlusDays(5)

function happyPath(overrides: Record<string, Resolved | (() => Resolved)> = {}) {
  resolvers = new Map()
  const defaults: Record<string, Resolved> = {
    'from:tenants': { data: { modules: { services: true }, timezone: 'UTC' }, error: null },
    'from:appointment_settings': {
      data: { auto_confirm: false, booking_horizon_days: 30, allow_client_reschedule: false, allow_client_cancellation: true },
      error: null,
    },
    'from:branches': { data: { id: 'branch-1' }, error: null },
    'from:services': {
      data: [{ id: 'svc-1', duration: 60, is_bookable: true, name: 'Стрижка', price: 1000, category_id: null }],
      error: null,
    },
    'from:resources': { data: [{ id: 'res-1', name: 'Маша' }], error: null },
    'junction:service_resources': { data: [{ service_id: 'svc-1', resource_id: 'res-1' }], error: null },
    'junction:resource_categories': { data: [], error: null },
  }
  for (const [k, v] of Object.entries(defaults)) setResolver(k, v)
  for (const [k, v] of Object.entries(overrides)) setResolver(k, v)

  mockRpc.mockResolvedValue({
    data: {
      group_id: 'group-1',
      appointments: [{ id: 'appt-1', service_id: 'svc-1', starts_at: '...', ends_at: '...' }],
    },
    error: null,
  })

  // Auth context: гость по умолчанию (401 = guest path).
  mockGetAuthCustomer.mockRejectedValue({ statusCode: 401 })
}

function makeEvent() {
  return {
    context: { tenantId: 'tenant-A' },
    headers: new Headers(),
    node: { req: { headers: {}, socket: { remoteAddress: currentRemoteAddress } }, res: {} },
  } as any
}

const validBody: BulkPayload = {
  customerName: 'Тест',
  customerPhone: '+79991234567',
  date: FUTURE_DATE,
  items: [{ serviceId: 'svc-1', resourceId: 'res-1', startTime: '10:00' }],
  branchId: null,
}

// Каждый тест сбрасывает rate-limit через уникальный IP, чтобы не упереться
// в лимит createRateLimiter(5, 60_000) после 5 успешных тестов.
let ipCounter = 0

beforeEach(() => {
  vi.clearAllMocks()
  resolvers = new Map()
  resolverCallIdx = new Map()
  ipCounter += 1
  currentRemoteAddress = `127.0.0.${ipCounter}`
})

// ──────────────────────────────────────────────────────────────────────────
// A. Валидация body — отсекается до первого DB-запроса
// ──────────────────────────────────────────────────────────────────────────

describe('POST /api/appointments/bulk — валидация body', () => {
  async function callHandler(body: any) {
    happyPath()
    mockReadBody.mockResolvedValue(body)
    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function
    return handler(makeEvent())
  }

  it('пустое имя → 400', async () => {
    await expect(callHandler({ ...validBody, customerName: '   ' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('пустой телефон → 400', async () => {
    await expect(callHandler({ ...validBody, customerPhone: '' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('некорректный российский телефон → 400', async () => {
    await expect(callHandler({ ...validBody, customerPhone: '+1 (212) 555-1234' }))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/телефон/i) })
  })

  it('дата не в формате YYYY-MM-DD → 400', async () => {
    await expect(callHandler({ ...validBody, date: '15.06.2030' }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('items пустой → 400', async () => {
    await expect(callHandler({ ...validBody, items: [] }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('items не массив → 400', async () => {
    await expect(callHandler({ ...validBody, items: 'not-an-array' }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('notes длиннее 1000 символов → 400', async () => {
    await expect(callHandler({ ...validBody, notes: 'x'.repeat(1001) }))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/длинный/i) })
  })

  it('item без serviceId → 400', async () => {
    await expect(callHandler({ ...validBody, items: [{ resourceId: 'r', startTime: '10:00' }] }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('item с невалидным startTime → 400', async () => {
    await expect(callHandler({ ...validBody, items: [{ serviceId: 's', resourceId: 'r', startTime: '10am' }] }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('happy path: все валидно → 200 + вызов RPC', async () => {
    happyPath()
    mockReadBody.mockResolvedValue(validBody)

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function
    const result = await handler(makeEvent())

    expect(result).toMatchObject({ visitId: 'group-1' })
    expect(mockRpc).toHaveBeenCalledWith('create_appointments_bulk', expect.any(Object))
  })
})

// ──────────────────────────────────────────────────────────────────────────
// B. Rate-limit — больше N запросов с одного IP
// ──────────────────────────────────────────────────────────────────────────

describe('POST /api/appointments/bulk — rate limit', () => {
  it('после 5 запросов с одного IP → 429', async () => {
    happyPath()
    mockReadBody.mockResolvedValue(validBody)

    // Один и тот же IP во всех итерациях этого теста.
    currentRemoteAddress = '10.0.0.99'

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    // 5 успешных
    for (let i = 0; i < 5; i++) {
      await handler(makeEvent())
    }

    // 6-я должна быть отбита rate-limiter'ом
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 })
  })
})

// ──────────────────────────────────────────────────────────────────────────
// C. Модуль services выключен на тенанте
// ──────────────────────────────────────────────────────────────────────────

describe('POST /api/appointments/bulk — module check', () => {
  it('tenant.modules.services=false → 400', async () => {
    happyPath({
      'from:tenants': { data: { modules: { services: false }, timezone: 'UTC' }, error: null },
    })
    mockReadBody.mockResolvedValue(validBody)

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/недоступна/i) })
  })
})

// ──────────────────────────────────────────────────────────────────────────
// D. Date constraints — прошедшая дата, horizon
// ──────────────────────────────────────────────────────────────────────────

describe('POST /api/appointments/bulk — date constraints', () => {
  it('дата в прошлом → 400', async () => {
    happyPath()
    mockReadBody.mockResolvedValue({ ...validBody, date: '2000-01-01' })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/прошедшую/i) })
  })

  it('дата за горизонтом booking_horizon_days → 400', async () => {
    happyPath({
      'from:appointment_settings': {
        data: { auto_confirm: false, booking_horizon_days: 3, allow_client_reschedule: false, allow_client_cancellation: true },
        error: null,
      },
    })
    // horizon=3 дня, FUTURE_DATE=сегодня+5 дней → за горизонтом.
    mockReadBody.mockResolvedValue({ ...validBody, date: FUTURE_DATE })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/горизонт/i) })
  })
})

// ──────────────────────────────────────────────────────────────────────────
// E. Service / resource / branch validation
// ──────────────────────────────────────────────────────────────────────────

describe('POST /api/appointments/bulk — service/resource/branch checks', () => {
  it('service не найден в этом тенанте → 400', async () => {
    happyPath({ 'from:services': { data: [], error: null } })
    mockReadBody.mockResolvedValue(validBody)

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/не найдена/i) })
  })

  it('service.is_bookable=false → 400', async () => {
    happyPath({
      'from:services': {
        data: [{ id: 'svc-1', duration: 60, is_bookable: false, name: 'Стрижка', price: 1000, category_id: null }],
        error: null,
      },
    })
    mockReadBody.mockResolvedValue(validBody)

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/недоступна для записи/i) })
  })

  it('указанный resourceId не принадлежит тенанту/неактивен → 400', async () => {
    happyPath({ 'from:resources': { data: [], error: null } })
    mockReadBody.mockResolvedValue(validBody)

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/недоступный исполнитель/i) })
  })

  it('branchId который не принадлежит тенанту → 400', async () => {
    happyPath({ 'from:branches': { data: null, error: null } })
    mockReadBody.mockResolvedValue({ ...validBody, branchId: 'foreign-branch' })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/филиал/i) })
  })

  it('resource не оказывает эту услугу (ни через service_resources, ни через категорию) → 400', async () => {
    happyPath({
      'junction:service_resources': { data: [], error: null },
      'junction:resource_categories': { data: [], error: null },
    })
    mockReadBody.mockResolvedValue(validBody)

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/не оказывает/i) })
  })
})

// ──────────────────────────────────────────────────────────────────────────
// F. autoConfirm — статус в RPC
// ──────────────────────────────────────────────────────────────────────────

describe('POST /api/appointments/bulk — autoConfirm flow', () => {
  it('autoConfirm=true → RPC вызван с p_status="confirmed"', async () => {
    happyPath({
      'from:appointment_settings': {
        data: { auto_confirm: true, booking_horizon_days: 30, allow_client_reschedule: false, allow_client_cancellation: true },
        error: null,
      },
    })
    mockReadBody.mockResolvedValue(validBody)

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function
    await handler(makeEvent())

    expect(mockRpc).toHaveBeenCalledWith('create_appointments_bulk',
      expect.objectContaining({ p_status: 'confirmed' }),
    )
  })

  it('autoConfirm=false → RPC вызван с p_status="new"', async () => {
    happyPath()
    mockReadBody.mockResolvedValue(validBody)

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function
    await handler(makeEvent())

    expect(mockRpc).toHaveBeenCalledWith('create_appointments_bulk',
      expect.objectContaining({ p_status: 'new' }),
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────
// G. RPC error mapping
// ──────────────────────────────────────────────────────────────────────────

describe('POST /api/appointments/bulk — RPC error mapping', () => {
  it('error code P0002 (slot taken) → 409', async () => {
    happyPath()
    mockReadBody.mockResolvedValue(validBody)
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'Slot is taken' },
    })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('error code P0001 (бизнес-ошибка из RPC) → 400 с сообщением из RPC', async () => {
    happyPath()
    mockReadBody.mockResolvedValue(validBody)
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Capacity exceeded' },
    })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('неизвестная RPC-ошибка → 500', async () => {
    happyPath()
    mockReadBody.mockResolvedValue(validBody)
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'XX999', message: 'oops' },
    })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 500 })
  })

  it('RPC вернул success без appointments → 500', async () => {
    happyPath()
    mockReadBody.mockResolvedValue(validBody)
    mockRpc.mockResolvedValue({ data: { group_id: 'g', appointments: [] }, error: null })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function

    await expect(handler(makeEvent()))
      .rejects.toMatchObject({ statusCode: 500 })
  })
})

// ──────────────────────────────────────────────────────────────────────────
// I. Overnight (план 1a): isNextDay=true сдвигает start/end-дату в RPC payload.
// ──────────────────────────────────────────────────────────────────────────

describe('POST /api/appointments/bulk — overnight isNextDay', () => {
  const fixedDate = todayPlusDays(5)
  const nextDate = todayPlusDays(6)

  it('isNextDay=true → starts_at в RPC построен на date+1', async () => {
    happyPath()
    mockReadBody.mockResolvedValue({
      ...validBody,
      date: fixedDate,
      items: [{ serviceId: 'svc-1', resourceId: 'res-1', startTime: '01:00', isNextDay: true }],
    })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function
    await handler(makeEvent())

    const rpcArgs = mockRpc.mock.calls[0][1]
    const item = rpcArgs.p_items[0]
    // svc-1 в happyPath: duration=60. starts_at = date+1 01:00 UTC. ends_at = date+1 02:00 UTC.
    expect(item.starts_at).toBe(`${nextDate}T01:00:00.000Z`)
    expect(item.ends_at).toBe(`${nextDate}T02:00:00.000Z`)
  })

  it('isNextDay=false (или не передан) → starts_at на date (бэккомпат)', async () => {
    happyPath()
    mockReadBody.mockResolvedValue({
      ...validBody,
      date: fixedDate,
      items: [{ serviceId: 'svc-1', resourceId: 'res-1', startTime: '10:00' }], // нет isNextDay
    })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function
    await handler(makeEvent())

    const rpcArgs = mockRpc.mock.calls[0][1]
    const item = rpcArgs.p_items[0]
    expect(item.starts_at).toBe(`${fixedDate}T10:00:00.000Z`)
    expect(item.ends_at).toBe(`${fixedDate}T11:00:00.000Z`)
  })

  it('start 23:30 + duration 60 → end переезжает на следующие сутки (start_time + duration >= 24:00)', async () => {
    // svc-1 в happyPath duration=60. start 23:30 → end 00:30 D+1 (натянулось через полночь).
    happyPath()
    mockReadBody.mockResolvedValue({
      ...validBody,
      date: fixedDate,
      items: [{ serviceId: 'svc-1', resourceId: 'res-1', startTime: '23:30' }],
    })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function
    await handler(makeEvent())

    const item = mockRpc.mock.calls[0][1].p_items[0]
    expect(item.starts_at).toBe(`${fixedDate}T23:30:00.000Z`)
    expect(item.ends_at).toBe(`${nextDate}T00:30:00.000Z`)
  })

  it('mixed payload: один item на D, второй isNextDay=true на D+1', async () => {
    // Группа из 2-х услуг через полночь: svc-1 23:00→00:00 D→D+1, svc-2 00:00→01:00 D+1.
    happyPath({
      'from:services': {
        data: [
          { id: 'svc-1', duration: 60, is_bookable: true, name: 'A', price: 1000, category_id: null },
          { id: 'svc-2', duration: 60, is_bookable: true, name: 'B', price: 1000, category_id: null },
        ],
        error: null,
      },
      'junction:service_resources': {
        data: [
          { service_id: 'svc-1', resource_id: 'res-1' },
          { service_id: 'svc-2', resource_id: 'res-1' },
        ],
        error: null,
      },
    })
    mockReadBody.mockResolvedValue({
      ...validBody,
      date: fixedDate,
      items: [
        { serviceId: 'svc-1', resourceId: 'res-1', startTime: '23:00' },
        { serviceId: 'svc-2', resourceId: 'res-1', startTime: '00:00', isNextDay: true },
      ],
    })

    const mod = await import('../api/appointments/bulk.post')
    const handler = mod.default as Function
    await handler(makeEvent())

    const items = mockRpc.mock.calls[0][1].p_items
    // svc-1: start 23:00 D, end 00:00 D+1 (через полночь по правилу end>=1440 → endDate+1).
    expect(items[0].starts_at).toBe(`${fixedDate}T23:00:00.000Z`)
    expect(items[0].ends_at).toBe(`${nextDate}T00:00:00.000Z`)
    // svc-2: isNextDay=true → start 00:00 D+1, end 01:00 D+1.
    expect(items[1].starts_at).toBe(`${nextDate}T00:00:00.000Z`)
    expect(items[1].ends_at).toBe(`${nextDate}T01:00:00.000Z`)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// H. Round-robin auto-pick (resourceId=null, бэк подбирает кандидата)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Хелпер: настроить «autoPath» — handler заходит в auto-block потому что у item
 * resourceId=null. Заранее настраивает все sequential-вызовы:
 *
 *  - service_resources: [explicit (для resourceIds=[]→пусто), auto (с реальными links)]
 *  - resource_categories: [explicit, auto]
 *  - resources: [для явных resourceIds → пусто, для всех active → ВСЕ ресурсы]
 *  - resource_branches: один вызов
 *  - appointments: [day-load, busy-check для каждого item]
 */
function autoPath(opts: {
  service?: { id: string; category_id: string | null }
  candidates: string[] // все кандидаты, которые auto-block должен «увидеть»
  serviceResourceLinks: string[] // resourceIds которые умеют делать service через service_resources
  categoryLinks?: Array<{ category_id: string; resource_id: string }>
  branchLinks?: Array<{ resource_id: string; branch_id: string }>
  dayLoad?: Array<{ resource_id: string }> // запись = +1 к нагрузке мастера в этот день
  busyByItemSlot?: string[][] // для каждого item: список занятых resource_ids в его слот
  branchId?: string | null
  autoConfirm?: boolean
  itemsCount?: number
}) {
  const service = opts.service ?? { id: 'svc-1', category_id: null }
  const itemsCount = opts.itemsCount ?? 1
  const busyByItemSlot = opts.busyByItemSlot ?? Array(itemsCount).fill([])

  resolvers = new Map()
  resolverCallIdx = new Map()

  setResolver('from:tenants', { data: { modules: { services: true }, timezone: 'UTC' }, error: null })
  setResolver('from:appointment_settings', {
    data: {
      auto_confirm: opts.autoConfirm ?? false,
      booking_horizon_days: 30,
      allow_client_reschedule: false,
      allow_client_cancellation: true,
    },
    error: null,
  })
  setResolver('from:branches', { data: { id: opts.branchId ?? 'branch-1' }, error: null })
  setResolver('from:services', {
    data: [{ id: service.id, duration: 60, is_bookable: true, name: 'Стрижка', price: 1000, category_id: service.category_id }],
    error: null,
  })

  // Sequential: 1-й from:resources — для явных resourceIds (их нет → пусто).
  // 2-й — все active кандидаты в auto-block.
  setResolver('from:resources', [
    { data: [], error: null },
    { data: opts.candidates.map((id) => ({ id, name: id })), error: null },
  ])

  // Sequential service_resources: 1-й — для resourceIds=[] (explicit, пусто),
  // 2-й — для autoServiceIds (links).
  setResolver('junction:service_resources', [
    { data: [], error: null },
    { data: opts.serviceResourceLinks.map((rid) => ({ service_id: service.id, resource_id: rid })), error: null },
  ])

  // Sequential resource_categories: 1-й — для resourceIds=[] (пусто),
  // 2-й — для autoCategoryIds (если есть категория услуги).
  setResolver('junction:resource_categories', [
    { data: [], error: null },
    { data: opts.categoryLinks ?? [], error: null },
  ])

  setResolver('junction:resource_branches', { data: opts.branchLinks ?? [], error: null })

  // appointments: 1-й вызов — day-load (count записей за день);
  // последующие — busy-check для каждого item (по одному вызову на item).
  setResolver('from:appointments', [
    { data: opts.dayLoad ?? [], error: null },
    ...busyByItemSlot.map((busyIds) => ({ data: busyIds.map((id: string) => ({ resource_id: id })), error: null })),
  ])

  mockRpc.mockResolvedValue({
    data: {
      group_id: 'group-1',
      appointments: opts.candidates.map((id, i) => ({ id: `appt-${i}`, service_id: service.id, starts_at: '...', ends_at: '...' })),
    },
    error: null,
  })

  mockGetAuthCustomer.mockRejectedValue({ statusCode: 401 })
}

async function runHandler() {
  const mod = await import('../api/appointments/bulk.post')
  const handler = mod.default as Function
  return handler(makeEvent())
}

const autoBody = (overrides: Partial<typeof validBody> = {}) => ({
  ...validBody,
  branchId: 'branch-1',
  items: [{ serviceId: 'svc-1', resourceId: null, startTime: '10:00' }],
  ...overrides,
})

describe('POST /api/appointments/bulk — round-robin auto-pick', () => {
  it('tie-break при равной нагрузке: выбирается кандидат с меньшим id', async () => {
    autoPath({
      candidates: ['res-A', 'res-B'],
      serviceResourceLinks: ['res-A', 'res-B'],
    })
    mockReadBody.mockResolvedValue(autoBody())

    await runHandler()

    const rpcCall = mockRpc.mock.calls[0]
    expect(rpcCall[0]).toBe('create_appointments_bulk')
    expect(rpcCall[1].p_items[0].resource_id).toBe('res-A')
    expect(rpcCall[1].p_items[0].resource_assigned_by).toBe('auto')
  })

  it('меньшая дневная нагрузка побеждает: 2 брони у Маши, 0 у Лены → Лена', async () => {
    autoPath({
      candidates: ['res-Masha', 'res-Lena'],
      serviceResourceLinks: ['res-Masha', 'res-Lena'],
      dayLoad: [
        { resource_id: 'res-Masha' },
        { resource_id: 'res-Masha' },
      ],
    })
    mockReadBody.mockResolvedValue(autoBody())

    await runHandler()

    expect(mockRpc.mock.calls[0][1].p_items[0].resource_id).toBe('res-Lena')
  })

  it('все кандидаты заняты в этот слот → 409', async () => {
    autoPath({
      candidates: ['res-A', 'res-B'],
      serviceResourceLinks: ['res-A', 'res-B'],
      busyByItemSlot: [['res-A', 'res-B']],
    })
    mockReadBody.mockResolvedValue(autoBody())

    await expect(runHandler())
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/нет свободных/i) })

    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('никаких компетенций (нет service_resources, нет resource_categories) → 400', async () => {
    autoPath({
      candidates: ['res-A'],
      serviceResourceLinks: [], // нет связи через service_resources
      categoryLinks: [], // нет связи через категорию
    })
    mockReadBody.mockResolvedValue(autoBody())

    await expect(runHandler())
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/нет доступных исполнителей/i) })
  })

  it('компетенции через категорию ресурса работают (без явного service_resources)', async () => {
    autoPath({
      service: { id: 'svc-1', category_id: 'cat-1' },
      candidates: ['res-A'],
      serviceResourceLinks: [], // явных нет
      categoryLinks: [{ category_id: 'cat-1', resource_id: 'res-A' }], // через категорию
    })
    mockReadBody.mockResolvedValue(autoBody())

    await runHandler()

    expect(mockRpc.mock.calls[0][1].p_items[0].resource_id).toBe('res-A')
  })

  it('branch-фильтр: ресурс без resource_branches связей → доступен в любом филиале', async () => {
    // У res-A нет ни одной записи в resource_branches → links.length=0 → НЕ исключаем
    // (двойное отрицание в коде: `links.length > 0 && !links.includes(branchId)`).
    autoPath({
      candidates: ['res-A'],
      serviceResourceLinks: ['res-A'],
      branchLinks: [], // никаких связей
      branchId: 'branch-1',
    })
    mockReadBody.mockResolvedValue(autoBody())

    await runHandler()

    expect(mockRpc.mock.calls[0][1].p_items[0].resource_id).toBe('res-A')
  })

  it('branch-фильтр: ресурс привязан к чужому филиалу → исключён', async () => {
    autoPath({
      candidates: ['res-A', 'res-B'],
      serviceResourceLinks: ['res-A', 'res-B'],
      branchLinks: [
        { resource_id: 'res-A', branch_id: 'branch-2' }, // чужой филиал
        { resource_id: 'res-B', branch_id: 'branch-1' }, // наш
      ],
      branchId: 'branch-1',
    })
    mockReadBody.mockResolvedValue(autoBody())

    await runHandler()

    expect(mockRpc.mock.calls[0][1].p_items[0].resource_id).toBe('res-B')
  })

  it('localBookings: единственный кандидат, 2 НЕпересекающихся слота → один мастер делает оба', async () => {
    // Реальный кейс: group-slots даёт цепочку «X с 10:00 час, потом 11:00 час»,
    // на сабмите оба item-а с resourceId=null. Раньше логика «у X уже есть
    // local-booking → исключить» отказывала на второй услуге даже если по таймингу
    // конфликта нет. Теперь local-booking трекается интервалами и проверяется overlap.
    autoPath({
      candidates: ['res-A'],
      serviceResourceLinks: ['res-A'],
      itemsCount: 2,
      busyByItemSlot: [[], []],
    })
    mockReadBody.mockResolvedValue(autoBody({
      items: [
        { serviceId: 'svc-1', resourceId: null, startTime: '10:00' },
        { serviceId: 'svc-1', resourceId: null, startTime: '11:00' },
      ],
    }))

    await runHandler()

    const items = mockRpc.mock.calls[0][1].p_items
    expect(items[0].resource_id).toBe('res-A')
    expect(items[1].resource_id).toBe('res-A')
  })

  it('localBookings: единственный кандидат, 2 ПЕРЕСЕКАЮЩИХСЯ слота → 409', async () => {
    // svc-1 duration=60, items 10:00-11:00 и 10:30-11:30 → overlap 10:30-11:00.
    // Локальный конфликт: один мастер не может сразу две — 409.
    autoPath({
      candidates: ['res-A'],
      serviceResourceLinks: ['res-A'],
      itemsCount: 2,
      busyByItemSlot: [[], []],
    })
    mockReadBody.mockResolvedValue(autoBody({
      items: [
        { serviceId: 'svc-1', resourceId: null, startTime: '10:00' },
        { serviceId: 'svc-1', resourceId: null, startTime: '10:30' },
      ],
    }))

    await expect(runHandler())
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('localBookings суммируется с дневной нагрузкой при выборе следующего', async () => {
    // 2 кандидата [res-A id=less, res-B], в БД у res-A 1 запись, res-B 0.
    // Bulk: 2 items.
    //   item-1: load A=1, B=0 → выбирается res-B (load=0).
    //   item-2: load A=1, B=0+1(local)=1 → tie → tie-break по id → res-A.
    autoPath({
      candidates: ['res-A', 'res-B'],
      serviceResourceLinks: ['res-A', 'res-B'],
      dayLoad: [{ resource_id: 'res-A' }],
      itemsCount: 2,
      busyByItemSlot: [[], []],
    })
    mockReadBody.mockResolvedValue(autoBody({
      items: [
        { serviceId: 'svc-1', resourceId: null, startTime: '10:00' },
        { serviceId: 'svc-1', resourceId: null, startTime: '11:00' },
      ],
    }))

    await runHandler()

    const items = mockRpc.mock.calls[0][1].p_items
    expect(items[0].resource_id).toBe('res-B')
    expect(items[1].resource_id).toBe('res-A')
  })

  it('mixed payload: assigned_by="auto" для null-resource items, "client" для явных', async () => {
    // Один item с явно заданным res-A, второй с null (auto).
    autoPath({
      candidates: ['res-A', 'res-B'],
      serviceResourceLinks: ['res-A', 'res-B'],
      busyByItemSlot: [[]], // только 1 auto-item
    })
    mockReadBody.mockResolvedValue(autoBody({
      items: [
        { serviceId: 'svc-1', resourceId: 'res-A', startTime: '10:00' },
        { serviceId: 'svc-1', resourceId: null, startTime: '11:00' },
      ],
    }))

    // Чтобы прошла explicit-валидация: 1-й from:resources вернёт res-A,
    // 1-й junction:service_resources — связь res-A-svc-1.
    setResolver('from:resources', [
      { data: [{ id: 'res-A', name: 'Маша' }], error: null }, // explicit check
      { data: [{ id: 'res-A', name: 'Маша' }, { id: 'res-B', name: 'Лена' }], error: null }, // auto candidates
    ])
    setResolver('junction:service_resources', [
      { data: [{ service_id: 'svc-1', resource_id: 'res-A' }], error: null }, // explicit
      { data: [{ service_id: 'svc-1', resource_id: 'res-A' }, { service_id: 'svc-1', resource_id: 'res-B' }], error: null }, // auto
    ])

    await runHandler()

    const items = mockRpc.mock.calls[0][1].p_items
    expect(items[0]).toMatchObject({ resource_id: 'res-A', resource_assigned_by: 'client' })
    expect(items[1]).toMatchObject({ resource_assigned_by: 'auto' })
    expect(items[1].resource_id).toBeTruthy() // подобран auto
  })
})
