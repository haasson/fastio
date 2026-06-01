import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { tablesApi, mapTable } from '../api/tables'

// ── Базовая строка таблицы для маппера ────────────────────────
const makeTableRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'table-1',
  tenant_id: 'tenant-1',
  branch_id: 'br-1',
  name: 'Стол 1',
  is_open: false,
  is_active: true,
  opened_at: null,
  created_at: '2026-01-01T00:00:00Z',
  capacity: null,
  tags: [],
  position_x: null,
  position_y: null,
  shape: 'rectangle',
  table_width: 120,
  table_height: 80,
  rotation: 0,
  color: null,
  notes: null,
  ...overrides,
})

// ── Fluent-мок PostgREST builder ──────────────────────────────
// Любой chainable метод возвращает тот же builder; await → resolved result.
// chainSpy ловит аргументы eq/order для проверки в тестах.
type QueryResult = {
  data?: Array<Record<string, unknown>> | null
  error: { message: string } | null
}

const makeBuilder = (result: QueryResult, chainSpy: Record<string, unknown[][]>) => {
  const builder: Record<string, unknown> = {
    then: (resolve: (r: QueryResult) => unknown) => resolve(result),
  }

  for (const m of ['select', 'eq', 'order'] as const) {
    chainSpy[m] = []
    builder[m] = (...args: unknown[]) => {
      chainSpy[m].push(args)

      return builder
    }
  }

  return builder
}

const makeSb = (
  result: QueryResult,
  chainSpy: Record<string, unknown[][]>,
): SupabaseClient => ({
  from: (_table: string) => makeBuilder(result, chainSpy),
} as unknown as SupabaseClient)

// ── mapper tests ───────────────────────────────────────────────

describe('mapTable', () => {
  it('маппит branchId из branch_id — стол всегда принадлежит филиалу (инвариант, BD NOT NULL)', () => {
    const table = mapTable(makeTableRow({ branch_id: 'br-1' }))

    expect(table.branchId).toBe('br-1')
  })
})

// ── tablesApi.list branch filter tests ─────────────────────────

describe('tablesApi.list branch filter', () => {
  it('list без branchId (undefined) → фильтрует по tenant_id + is_active, НЕ по branch_id', async () => {
    const chain: Record<string, unknown[][]> = {}
    const sb = makeSb({ data: [], error: null }, chain)

    await tablesApi.list(sb, 'tenant-1')

    expect(chain.eq).toContainEqual(['tenant_id', 'tenant-1'])
    expect(chain.eq).toContainEqual(['is_active', true])

    const hasBranchFilter = chain.eq.some(([col]) => col === 'branch_id')

    expect(hasBranchFilter).toBe(false)
  })

  it('list с branchId строкой → применяет .eq("branch_id", branchId)', async () => {
    const chain: Record<string, unknown[][]> = {}
    const sb = makeSb({ data: [], error: null }, chain)

    await tablesApi.list(sb, 'tenant-1', 'br-1')

    expect(chain.eq).toContainEqual(['branch_id', 'br-1'])
  })

  it('list с branchId=null (D-04) → НЕ применяет branch-фильтр', async () => {
    const chain: Record<string, unknown[][]> = {}
    const sb = makeSb({ data: [], error: null }, chain)

    await tablesApi.list(sb, 'tenant-1', null)

    const hasBranchFilter = chain.eq.some(([col]) => col === 'branch_id')

    expect(hasBranchFilter).toBe(false)
  })
})
