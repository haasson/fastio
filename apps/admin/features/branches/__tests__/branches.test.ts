import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { branchesApi, mapBranch } from '../api/branches'

// Заглушка для reportError — мы только проверяем, что он вызван на error-path,
// без реального улёта в Sentry. Путь должен совпадать с импортом в branches.ts.
const reportErrorMock = vi.fn()

vi.mock('~/shared/utils/reportError', () => ({
  reportError: (...args: unknown[]) => reportErrorMock(...args),
}))

const makeBranchRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'branch-1',
  tenant_id: 'tenant-1',
  name: 'Центральный',
  color: '#FF5733',
  address: 'ул. Ленина 1',
  phone: '+7 999 123-45-67',
  is_active: true,
  working_hours_schedule: { default: { open: '10:00', close: '22:00' }, days: {} },
  delivery_min_order: 500,
  delivery_fee: 100,
  notifications: null,
  latitude: 55.75,
  longitude: 37.61,
  order_number_prefix: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
  ...overrides,
})

describe('mapBranch', () => {
  it('маппит базовые поля', () => {
    const branch = mapBranch(makeBranchRow())

    expect(branch.id).toBe('branch-1')
    expect(branch.tenantId).toBe('tenant-1')
    expect(branch.name).toBe('Центральный')
    expect(branch.color).toBe('#FF5733')
    expect(branch.address).toBe('ул. Ленина 1')
    expect(branch.phone).toBe('+7 999 123-45-67')
    expect(branch.isActive).toBe(true)
  })

  it('маппит рабочие часы как объект', () => {
    const branch = mapBranch(makeBranchRow())

    expect(branch.workingHoursSchedule).toEqual({ default: { open: '10:00', close: '22:00' }, days: {} })
  })

  it('маппит координаты', () => {
    const branch = mapBranch(makeBranchRow())

    expect(branch.latitude).toBe(55.75)
    expect(branch.longitude).toBe(37.61)
  })

  it('order_number_prefix null → null', () => {
    expect(mapBranch(makeBranchRow({ order_number_prefix: null })).orderNumberPrefix).toBeNull()
  })

  it('order_number_prefix заполненный — маппится', () => {
    expect(mapBranch(makeBranchRow({ order_number_prefix: 'ЦЛ' })).orderNumberPrefix).toBe('ЦЛ')
  })

  it('archived_at null → null', () => {
    expect(mapBranch(makeBranchRow({ archived_at: null })).archivedAt).toBeNull()
  })

  it('archived_at заполненный — маппится', () => {
    const branch = mapBranch(makeBranchRow({ archived_at: '2026-03-01T00:00:00Z' }))

    expect(branch.archivedAt).toBe('2026-03-01T00:00:00Z')
  })

  it('delivery_min_order и delivery_fee маппятся', () => {
    const branch = mapBranch(makeBranchRow({ delivery_min_order: 1000, delivery_fee: 200 }))

    expect(branch.deliveryMinOrder).toBe(1000)
    expect(branch.deliveryFee).toBe(200)
  })

  it('created_at и updated_at маппятся', () => {
    const branch = mapBranch(makeBranchRow())

    expect(branch.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(branch.updatedAt).toBe('2026-01-01T00:00:00Z')
  })
})

// ─── hasActiveOrders / hasActiveReservations / hasActiveAppointments (PREPROD-020) ──
//
// Fluent-мок строителя PostgREST. Любой chainable метод (.select/.eq/.in/.gte/.or)
// возвращает сам builder; await на builder → resolved result. Передаём
// `chainSpy`, чтобы тест мог проверить какие eq/in/gte/or вызывались.
type QueryResult = {
  count?: number | null
  data?: Array<Record<string, unknown>> | null
  error: { message: string } | null
}

const makeBuilder = (result: QueryResult, chainSpy: Record<string, unknown[][]>) => {
  const builder: Record<string, unknown> = {
    then: (resolve: (r: QueryResult) => unknown) => resolve(result),
  }

  for (const m of ['select', 'eq', 'in', 'gte', 'or'] as const) {
    chainSpy[m] = []
    builder[m] = (...args: unknown[]) => {
      chainSpy[m].push(args)

      return builder
    }
  }

  return builder
}

// Per-table результаты — для hasActiveOrders нужны два разных ответа
// (один на запрос order_statuses, другой на orders). makeSb принимает либо
// один result (любая таблица), либо мапу table → result.
const makeSb = (
  resultOrMap: QueryResult | Record<string, QueryResult>,
  chainSpy: Record<string, unknown[][]>,
): SupabaseClient => ({
  from: (table: string) => {
    const result = (resultOrMap && typeof resultOrMap === 'object' && 'error' in resultOrMap)
      ? (resultOrMap as QueryResult)
      : (resultOrMap as Record<string, QueryResult>)[table] ?? { error: null }

    return makeBuilder(result, chainSpy)
  },
} as unknown as SupabaseClient)

describe('branchesApi.hasActiveReservations', () => {
  beforeEach(() => {
    reportErrorMock.mockReset()
  })

  it('count > 0 → true (есть активная бронь)', async () => {
    const sb = makeSb({ count: 3, error: null }, {})
    const result = await branchesApi.hasActiveReservations(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(true)
  })

  it('count = 0 → false (активных броней нет)', async () => {
    const sb = makeSb({ count: 0, error: null }, {})
    const result = await branchesApi.hasActiveReservations(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(false)
  })

  it('count = null → false (PostgREST вернул null без ошибки)', async () => {
    const sb = makeSb({ count: null, error: null }, {})
    const result = await branchesApi.hasActiveReservations(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(false)
  })

  it('фильтрует по tenant_id, branch_id и активным статусам', async () => {
    const chain: Record<string, unknown[][]> = {}
    const sb = makeSb({ count: 0, error: null }, chain)

    await branchesApi.hasActiveReservations(sb, 'branch-1', 'tenant-1')

    expect(chain.eq).toContainEqual(['tenant_id', 'tenant-1'])
    expect(chain.eq).toContainEqual(['branch_id', 'branch-1'])
    expect(chain.in).toContainEqual(['status', ['pending', 'confirmed', 'seated']])
    // or-фильтр: «сегодня после now-time ИЛИ дата в будущем»
    // Сигнатура: reserved_date.gt.YYYY-MM-DD,and(reserved_date.eq.YYYY-MM-DD,reserved_time.gte.HH:MM:SS)
    expect(chain.or[0][0]).toMatch(
      /^reserved_date\.gt\.\d{4}-\d{2}-\d{2},and\(reserved_date\.eq\.\d{4}-\d{2}-\d{2},reserved_time\.gte\.\d{2}:\d{2}:\d{2}\)$/,
    )
  })

  it('error от Supabase → reportError + fail-safe true', async () => {
    const sb = makeSb({ count: null, error: { message: 'permission denied' } }, {})
    const result = await branchesApi.hasActiveReservations(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(true) // fail-safe — блокируем архивацию
    expect(reportErrorMock).toHaveBeenCalledOnce()
    expect(reportErrorMock.mock.calls[0][1]).toMatchObject({
      context: 'branches.hasActiveReservations',
      branchId: 'branch-1',
      tenantId: 'tenant-1',
    })
  })
})

describe('branchesApi.hasActiveAppointments', () => {
  beforeEach(() => {
    reportErrorMock.mockReset()
  })

  it('count > 0 → true (есть активная запись)', async () => {
    const sb = makeSb({ count: 1, error: null }, {})
    const result = await branchesApi.hasActiveAppointments(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(true)
  })

  it('count = 0 → false (активных записей нет)', async () => {
    const sb = makeSb({ count: 0, error: null }, {})
    const result = await branchesApi.hasActiveAppointments(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(false)
  })

  it('фильтрует по tenant_id, branch_id и активным статусам', async () => {
    const chain: Record<string, unknown[][]> = {}
    const sb = makeSb({ count: 0, error: null }, chain)

    await branchesApi.hasActiveAppointments(sb, 'branch-1', 'tenant-1')

    expect(chain.eq).toContainEqual(['tenant_id', 'tenant-1'])
    expect(chain.eq).toContainEqual(['branch_id', 'branch-1'])
    expect(chain.in).toContainEqual(['status', ['new', 'confirmed']])
    // starts_at >= now (ISO timestamp с миллисекундами и Z)
    expect(chain.gte[0][0]).toBe('starts_at')
    expect(chain.gte[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/)
  })

  it('error от Supabase → reportError + fail-safe true', async () => {
    const sb = makeSb({ count: null, error: { message: 'rls violation' } }, {})
    const result = await branchesApi.hasActiveAppointments(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(true) // fail-safe
    expect(reportErrorMock).toHaveBeenCalledOnce()
    expect(reportErrorMock.mock.calls[0][1]).toMatchObject({
      context: 'branches.hasActiveAppointments',
      branchId: 'branch-1',
      tenantId: 'tenant-1',
    })
  })
})

describe('branchesApi.hasActiveOrders', () => {
  beforeEach(() => {
    reportErrorMock.mockReset()
  })

  it('нет активных статусов в тенанте → false (без обращения к orders)', async () => {
    const sb = makeSb({ order_statuses: { data: [], error: null } }, {})
    const result = await branchesApi.hasActiveOrders(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(false)
  })

  it('есть статусы, count > 0 → true', async () => {
    const sb = makeSb({
      order_statuses: { data: [{ id: 's1' }, { id: 's2' }], error: null },
      orders: { count: 5, error: null },
    }, {})
    const result = await branchesApi.hasActiveOrders(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(true)
  })

  it('есть статусы, count = 0 → false', async () => {
    const sb = makeSb({
      order_statuses: { data: [{ id: 's1' }], error: null },
      orders: { count: 0, error: null },
    }, {})
    const result = await branchesApi.hasActiveOrders(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(false)
  })

  it('error от order_statuses → fail-safe true + reportError', async () => {
    const sb = makeSb({
      order_statuses: { data: null, error: { message: 'rls fail' } },
    }, {})
    const result = await branchesApi.hasActiveOrders(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(true) // fail-safe
    expect(reportErrorMock).toHaveBeenCalledOnce()
    expect(reportErrorMock.mock.calls[0][1]).toMatchObject({
      context: 'branches.hasActiveOrders.statuses',
      branchId: 'branch-1',
      tenantId: 'tenant-1',
    })
  })

  it('error от orders → fail-safe true + reportError', async () => {
    const sb = makeSb({
      order_statuses: { data: [{ id: 's1' }], error: null },
      orders: { count: null, error: { message: 'timeout' } },
    }, {})
    const result = await branchesApi.hasActiveOrders(sb, 'branch-1', 'tenant-1')

    expect(result).toBe(true)
    expect(reportErrorMock).toHaveBeenCalledOnce()
    expect(reportErrorMock.mock.calls[0][1]).toMatchObject({
      context: 'branches.hasActiveOrders.orders',
      branchId: 'branch-1',
      tenantId: 'tenant-1',
    })
  })
})
