/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * PREPROD-223: единый helper findOrCreateCustomer, дедуплицирующий логику
 * между login.post.ts и poll.get.ts. Тесты гоняют логику на «фейковом»
 * supabase-клиенте, который воспроизводит цепочку from().select/insert/update
 * с уникальным constraint'ом на (tenant_id, telegram_id).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError } from 'h3'
import { findOrCreateCustomer } from '../findOrCreateCustomer'

const mockReportError = vi.fn()
vi.mock('@fastio/shared/observability', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

;(globalThis as any).createError = createError

type Row = { id: string; tenant_id: string; telegram_id: string; phone: string | null; name: string | null; avatar_url: string | null }

/**
 * Фейковый supabase-клиент. Поддерживает достаточно цепочки методов чтобы
 * findOrCreateCustomer работал поверх него: from().select().eq().eq().maybeSingle(),
 * .insert().select().single(), .update().eq().
 *
 * Эмулирует уникальный constraint (tenant_id, telegram_id) — при попытке
 * вставить дубль возвращает ошибку с code '23505'.
 */
function makeSupabase(rows: Row[] = []) {
  const insertCalls: Array<Record<string, unknown>> = []
  const updateCalls: Array<{ patch: Record<string, unknown>; id: string }> = []

  function from(table: string) {
    if (table !== 'customers') throw new Error(`unexpected table: ${table}`)

    return {
      select(_cols: string) {
        const eqs: Array<[string, unknown]> = []
        const builder: any = {
          eq(col: string, val: unknown) {
            eqs.push([col, val])
            return builder
          },
          maybeSingle() {
            const found = rows.find((r) => eqs.every(([col, val]) => (r as any)[col] === val))
            return Promise.resolve({ data: found ?? null, error: null })
          },
          single() {
            const found = rows.find((r) => eqs.every(([col, val]) => (r as any)[col] === val))
            if (found) return Promise.resolve({ data: found, error: null })
            return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
          },
        }
        return builder
      },
      insert(values: Record<string, unknown>) {
        insertCalls.push(values)
        const conflict = rows.find(
          (r) => r.tenant_id === values.tenant_id && r.telegram_id === values.telegram_id,
        )
        const row: Row = {
          id: `cust-${rows.length + 1}`,
          tenant_id: values.tenant_id as string,
          telegram_id: values.telegram_id as string,
          phone: (values.phone as string | null) ?? null,
          name: (values.name as string | null) ?? null,
          avatar_url: (values.avatar_url as string | null) ?? null,
        }
        return {
          select(_cols: string) {
            return {
              single() {
                if (conflict) {
                  return Promise.resolve({
                    data: null,
                    error: { code: '23505', message: 'unique violation' },
                  })
                }
                rows.push(row)
                return Promise.resolve({ data: { id: row.id }, error: null })
              },
            }
          },
        }
      },
      update(patch: Record<string, unknown>) {
        return {
          eq(col: string, val: unknown) {
            if (col === 'id') {
              const target = rows.find((r) => r.id === val)
              if (target) {
                Object.assign(target, patch)
                updateCalls.push({ patch, id: val as string })
                return Promise.resolve({ data: null, error: null })
              }
            }
            return Promise.resolve({ data: null, error: null })
          },
        }
      },
    }
  }

  return { from, insertCalls, updateCalls, rows }
}

beforeEach(() => {
  mockReportError.mockReset()
})

describe('findOrCreateCustomer', () => {
  it('создаёт новый customer когда строки нет', async () => {
    const sb = makeSupabase()
    const id = await findOrCreateCustomer(sb as any, {
      tenantId: 't1',
      telegramId: '123',
      name: 'Иван',
      photoUrl: 'https://t.me/pic.jpg',
    })
    expect(id).toBe('cust-1')
    expect(sb.rows).toHaveLength(1)
    expect(sb.rows[0]).toMatchObject({
      tenant_id: 't1',
      telegram_id: '123',
      name: 'Иван',
      avatar_url: 'https://t.me/pic.jpg',
    })
  })

  it('возвращает id существующего customer без новой записи', async () => {
    const sb = makeSupabase([
      { id: 'cust-existing', tenant_id: 't1', telegram_id: '123', phone: '+79001234567', name: 'Иван', avatar_url: null },
    ])
    const id = await findOrCreateCustomer(sb as any, {
      tenantId: 't1',
      telegramId: '123',
      name: 'Иван',
    })
    expect(id).toBe('cust-existing')
    expect(sb.insertCalls).toHaveLength(0)
  })

  it('backfill телефона: если у existing нет phone, а в seed есть — апдейтим', async () => {
    const sb = makeSupabase([
      { id: 'cust-existing', tenant_id: 't1', telegram_id: '123', phone: null, name: 'Иван', avatar_url: null },
    ])
    const id = await findOrCreateCustomer(sb as any, {
      tenantId: 't1',
      telegramId: '123',
      phone: '+79001234567',
    })
    expect(id).toBe('cust-existing')
    expect(sb.updateCalls).toHaveLength(1)
    expect(sb.updateCalls[0]).toEqual({ patch: { phone: '+79001234567' }, id: 'cust-existing' })
    expect(sb.rows[0].phone).toBe('+79001234567')
  })

  it('не перетирает существующий phone когда seed.phone указан', async () => {
    const sb = makeSupabase([
      { id: 'cust-existing', tenant_id: 't1', telegram_id: '123', phone: '+70000000000', name: null, avatar_url: null },
    ])
    const id = await findOrCreateCustomer(sb as any, {
      tenantId: 't1',
      telegramId: '123',
      phone: '+79001234567',
    })
    expect(id).toBe('cust-existing')
    expect(sb.updateCalls).toHaveLength(0)
    expect(sb.rows[0].phone).toBe('+70000000000')
  })

  it('не запускает update когда seed.phone не передан', async () => {
    const sb = makeSupabase([
      { id: 'cust-existing', tenant_id: 't1', telegram_id: '123', phone: null, name: 'Иван', avatar_url: null },
    ])
    await findOrCreateCustomer(sb as any, {
      tenantId: 't1',
      telegramId: '123',
      name: 'Иван',
      photoUrl: 'https://t.me/pic.jpg',
    })
    expect(sb.updateCalls).toHaveLength(0)
  })

  it('race-condition: при 23505 повторно читает строку конкурента', async () => {
    // Сценарий: lookup1 не нашёл строку → начинаем insert → пока insert идёт,
    // другой запрос успел записать. Мы получаем 23505 → перечитываем → возвращаем
    // id строки конкурента.
    const rows: Row[] = []
    let lookupCount = 0
    const sb: any = {
      from(table: string) {
        if (table !== 'customers') throw new Error(`unexpected table: ${table}`)
        return {
          select(_cols: string) {
            const eqs: Array<[string, unknown]> = []
            const builder: any = {
              eq(col: string, val: unknown) {
                eqs.push([col, val])
                return builder
              },
              maybeSingle() {
                lookupCount++
                // Первый lookup: ничего нет. Между ним и insert — конкурент
                // успевает записать строку.
                if (lookupCount === 1) {
                  rows.push({
                    id: 'cust-concurrent',
                    tenant_id: 't1',
                    telegram_id: '123',
                    phone: null,
                    name: 'Конкурент',
                    avatar_url: null,
                  })
                  return Promise.resolve({ data: null, error: null })
                }
                const found = rows.find((r) =>
                  eqs.every(([col, val]) => (r as any)[col] === val),
                )
                return Promise.resolve({ data: found ?? null, error: null })
              },
            }
            return builder
          },
          insert(_values: Record<string, unknown>) {
            return {
              select(_cols: string) {
                return {
                  single() {
                    return Promise.resolve({
                      data: null,
                      error: { code: '23505', message: 'unique violation' },
                    })
                  },
                }
              },
            }
          },
        }
      },
    }

    const id = await findOrCreateCustomer(sb, {
      tenantId: 't1',
      telegramId: '123',
      name: 'Я',
    })
    expect(id).toBe('cust-concurrent')
  })

  it('падает 500 если insert вернул не-23505 ошибку', async () => {
    const sb: any = {
      from(_table: string) {
        return {
          select(_cols: string) {
            const builder: any = {
              eq() { return builder },
              maybeSingle() { return Promise.resolve({ data: null, error: null }) },
            }
            return builder
          },
          insert(_values: Record<string, unknown>) {
            return {
              select(_cols: string) {
                return {
                  single() {
                    return Promise.resolve({
                      data: null,
                      error: { code: '42703', message: 'column does not exist' },
                    })
                  },
                }
              },
            }
          },
        }
      },
    }

    await expect(
      findOrCreateCustomer(sb, { tenantId: 't1', telegramId: '123' }),
    ).rejects.toMatchObject({ statusCode: 500 })
    expect(mockReportError).toHaveBeenCalled()
  })

  it('падает 500 при ошибке lookup', async () => {
    const sb: any = {
      from(_table: string) {
        return {
          select(_cols: string) {
            const builder: any = {
              eq() { return builder },
              maybeSingle() {
                return Promise.resolve({
                  data: null,
                  error: { code: '08000', message: 'connection failure' },
                })
              },
            }
            return builder
          },
        }
      },
    }

    await expect(
      findOrCreateCustomer(sb, { tenantId: 't1', telegramId: '123' }),
    ).rejects.toMatchObject({ statusCode: 500 })
    expect(mockReportError).toHaveBeenCalled()
  })

  it('race + 23505, но второй lookup тоже пустой → 500 (защита от бесконечного цикла)', async () => {
    const sb: any = {
      from(_table: string) {
        return {
          select(_cols: string) {
            const builder: any = {
              eq() { return builder },
              maybeSingle() { return Promise.resolve({ data: null, error: null }) },
            }
            return builder
          },
          insert(_values: Record<string, unknown>) {
            return {
              select(_cols: string) {
                return {
                  single() {
                    return Promise.resolve({
                      data: null,
                      error: { code: '23505', message: 'unique violation' },
                    })
                  },
                }
              },
            }
          },
        }
      },
    }

    await expect(
      findOrCreateCustomer(sb, { tenantId: 't1', telegramId: '123' }),
    ).rejects.toMatchObject({ statusCode: 500 })
  })
})
