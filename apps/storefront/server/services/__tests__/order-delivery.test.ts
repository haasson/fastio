import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError } from 'h3'

// createError — Nitro auto-import, регистрируем на globalThis до импорта сервиса
;(globalThis as Record<string, unknown>).createError = createError

// ---------------------------------------------------------------------------
// Moки Supabase
// ---------------------------------------------------------------------------

type MockChain = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
}

const tablesChain: MockChain = {
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  single: vi.fn(),
  order: vi.fn(),
}

const branchesChain: MockChain = {
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  single: vi.fn(),
  order: vi.fn(),
}

const deliveryZonesChain: MockChain = {
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  single: vi.fn(),
  order: vi.fn(),
}

// Настраиваем chainable-методы для каждой таблицы
for (const chain of [tablesChain, branchesChain, deliveryZonesChain]) {
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.is.mockReturnValue(chain)
  chain.single.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'tables') return tablesChain
  if (table === 'branches') return branchesChain
  if (table === 'delivery_zones') return deliveryZonesChain
  throw new Error(`Unexpected table in mock: ${table}`)
})

const mockSupabase = { from: mockFrom } as unknown as import('@supabase/supabase-js').SupabaseClient

// Динамический импорт — после установки createError на globalThis
const { resolveDelivery } = await import('../order-delivery')

// ---------------------------------------------------------------------------
// Фиксированная конфигурация тенанта (без доставки — dine_in)
// ---------------------------------------------------------------------------

const tenantConfig = {
  deliveryMode: 'fixed' as const,
  deliveryFee: 0,
  freeDeliveryFrom: 0,
  deliveryMinOrder: 0,
  modules: null,
  paymentMethods: ['cash'],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Настраивает мок tables.single() — возвращает стол с данными.
 */
function mockTable(tableId: string, branchId: string | null) {
  tablesChain.single.mockResolvedValueOnce({
    data: { id: tableId, name: 'Стол 1', is_open: true, branch_id: branchId },
    error: null,
  })
}

/**
 * Настраивает мок branches — возвращает список активных филиалов.
 */
function mockBranches(branches: Array<{ id: string }>) {
  // Цепочка branches в resolveDelivery завершается .is('archived_at', null) — мокаем её
  branchesChain.is.mockResolvedValueOnce({ data: branches, error: null })
}

/**
 * Настраивает мок delivery_zones — возвращает пустой список.
 */
function mockNoZones() {
  deliveryZonesChain.order.mockResolvedValueOnce({ data: [], error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Восстанавливаем chainable-возврат после clearAllMocks
  for (const chain of [tablesChain, branchesChain, deliveryZonesChain]) {
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.is.mockReturnValue(chain)
    chain.single.mockReturnValue(chain)
    chain.order.mockReturnValue(chain)
  }
})

// ---------------------------------------------------------------------------
// Тесты D-11/D-12
// ---------------------------------------------------------------------------

describe('resolveDelivery — dine_in branch routing', () => {
  it(
    'D-11: стол с branchId="park" → resolveDelivery.branchId = "park"',
    async () => {
      mockTable('table-1', 'park')
      mockBranches([{ id: 'park' }, { id: 'center' }])
      mockNoZones()

      const result = await resolveDelivery(
        mockSupabase,
        'tenant-1',
        'dine_in',
        { tableId: 'table-1' },
        tenantConfig,
        500,
      )

      expect(result.branchId).toBe('park')
    },
  )

  it(
    'D-12 fallback: стол без branchId + один активный филиал → branchId = единственный филиал',
    async () => {
      mockTable('table-2', null)
      mockBranches([{ id: 'only-branch' }])
      mockNoZones()

      const result = await resolveDelivery(
        mockSupabase,
        'tenant-1',
        'dine_in',
        { tableId: 'table-2' },
        tenantConfig,
        500,
      )

      expect(result.branchId).toBe('only-branch')
    },
  )

  it(
    'D-12 ошибка: стол без branchId + два активных филиала → throw 400',
    async () => {
      mockTable('table-3', null)
      mockBranches([{ id: 'branch-a' }, { id: 'branch-b' }])
      mockNoZones()

      await expect(
        resolveDelivery(
          mockSupabase,
          'tenant-1',
          'dine_in',
          { tableId: 'table-3' },
          tenantConfig,
          500,
        ),
      ).rejects.toMatchObject({ statusCode: 400 })
    },
  )

  it(
    'D-11 регресс: стол с branchId="park" на мультибранче → branchId = "park" (не случайный из branchRows)',
    async () => {
      mockTable('table-4', 'park')
      // Два филиала, park идёт вторым — убеждаемся, что не берётся первый
      mockBranches([{ id: 'center' }, { id: 'park' }])
      mockNoZones()

      const result = await resolveDelivery(
        mockSupabase,
        'tenant-1',
        'dine_in',
        { tableId: 'table-4' },
        tenantConfig,
        500,
      )

      expect(result.branchId).toBe('park')
      expect(result.branchId).not.toBe('center')
    },
  )
})
