import { describe, it, expect } from 'vitest'
import type { KitchenQueueItem } from '@fastio/shared'
import { useKitchenProgress } from '../composables/useKitchenProgress'
import type { TableSession, TableSessionItem } from '~/features/tables'

const makeKitchen = (overrides: Partial<KitchenQueueItem> = {}): KitchenQueueItem => ({
  id: 'k1',
  tenantId: 't1',
  orderId: 'o1',
  orderNumber: null,
  orderItemId: 'oi1',
  dishName: 'Сырник',
  dishId: 'd1',
  comboId: null,
  comboName: null,
  categoryName: null,
  modifiers: [],
  addons: [],
  removedIngredients: [],
  deliveryType: 'dine_in',
  status: 'queued',
  assignedTo: null,
  assignedAt: null,
  completedAt: null,
  servedAt: null,
  servedBy: null,
  dismissedAt: null,
  skipKitchen: false,
  charged: false,
  createdAt: '2026-01-01T00:00:00Z',
  scheduledAt: null,
  kitchenLeadMinutes: null,
  ...overrides,
})

const makeSessionItem = (overrides: Partial<TableSessionItem> = {}): TableSessionItem => ({
  id: null,
  dishId: 'd1',
  dishName: 'Сырник',
  categoryName: null,
  quantity: 1,
  price: 100,
  modifiers: [],
  addons: [],
  removedIngredients: [],
  status: 'confirmed',
  comboItems: null,
  ...overrides,
})

const session = (items: TableSessionItem[]): TableSession => ({ sum: 0, items })

const run = (
  dishes: KitchenQueueItem[],
  items: TableSessionItem[],
  options?: { includeDone?: boolean },
) => useKitchenProgress(() => dishes, () => session(items), options).kitchenProgress.value

// ─── Обычные блюда (комбо нет) — поведение не меняется ───

describe('useKitchenProgress — обычные блюда', () => {
  it('группирует одноимённые блюда в одну строку, цена из сессии', () => {
    const rows = run(
      [makeKitchen({ id: 'k1' }), makeKitchen({ id: 'k2' })],
      [makeSessionItem({ price: 100 })],
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(2)
    expect(rows[0].unitPrice).toBe(100)
    expect(rows[0].totalPrice).toBe(200)
    expect(rows[0].isCombo).toBe(false)
    expect(rows[0].comboName).toBeNull()
  })

  it('разные статусы одного блюда — разные строки', () => {
    const rows = run(
      [makeKitchen({ id: 'k1', status: 'queued' }), makeKitchen({ id: 'k2', status: 'in_progress' })],
      [makeSessionItem()],
      { includeDone: true },
    )

    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.isCombo === false)).toBe(true)
  })
})

// ─── Комбо — атомарная единица ───

describe('useKitchenProgress — комбо', () => {
  const comboKitchen = (dishName: string, over: Partial<KitchenQueueItem> = {}) => makeKitchen({
    orderItemId: 'combo-oi',
    comboId: 'combo-1',
    comboName: 'Комбо Завтрак',
    dishName,
    dishId: dishName,
    ...over,
  })

  const comboSession = (price = 450) => makeSessionItem({ dishName: 'Комбо Завтрак', dishId: 'combo-1', price })

  it('схлопывает блюда комбо в одну строку по orderItemId', () => {
    const rows = run(
      [
        comboKitchen('Сырник', { id: 'k1' }),
        comboKitchen('Кофе', { id: 'k2' }),
        comboKitchen('Блин', { id: 'k3' }),
      ],
      [comboSession()],
      { includeDone: true },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].isCombo).toBe(true)
    expect(rows[0].comboName).toBe('Комбо Завтрак')
    expect(rows[0].dishName).toBe('Комбо Завтрак')
    expect(rows[0].orderItemId).toBe('combo-oi')
    expect(rows[0].total).toBe(3)
    expect(rows[0].readyCount).toBe(0)
    expect(rows[0].ids.sort()).toEqual(['k1', 'k2', 'k3'])
  })

  it('берёт цену комбо из сессии по comboName (а не нули по блюдам)', () => {
    const rows = run(
      [comboKitchen('Сырник', { id: 'k1' }), comboKitchen('Кофе', { id: 'k2' })],
      [comboSession(450)],
      { includeDone: true },
    )

    expect(rows[0].unitPrice).toBe(450)
    expect(rows[0].totalPrice).toBe(450)
  })

  it('статус комбо = done только когда все блюда done', () => {
    const partial = run(
      [
        comboKitchen('Сырник', { id: 'k1', status: 'done' }),
        comboKitchen('Кофе', { id: 'k2', status: 'queued' }),
      ],
      [comboSession()],
      { includeDone: true },
    )

    expect(partial[0].status).not.toBe('done')
    expect(partial[0].readyCount).toBe(1)
    expect(partial[0].total).toBe(2)

    const allDone = run(
      [
        comboKitchen('Сырник', { id: 'k1', status: 'done' }),
        comboKitchen('Кофе', { id: 'k2', status: 'done' }),
      ],
      [comboSession()],
      { includeDone: true },
    )

    expect(allDone[0].status).toBe('done')
    expect(allDone[0].readyCount).toBe(2)
  })

  it('комбо×2 (одинаковый orderItemId) — одна строка, count=2, total по всем блюдам', () => {
    const rows = run(
      [
        comboKitchen('Сырник', { id: 'k1' }),
        comboKitchen('Кофе', { id: 'k2' }),
        comboKitchen('Сырник', { id: 'k3' }),
        comboKitchen('Кофе', { id: 'k4' }),
      ],
      [comboSession(450)],
      { includeDone: true },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].total).toBe(4)
    expect(rows[0].count).toBe(2)
    expect(rows[0].totalPrice).toBe(900)
  })

  it('served (skip-kitchen) блюдо комбо исключается из total и ids', () => {
    const rows = run(
      [
        comboKitchen('Сырник', { id: 'k1', status: 'queued' }),
        comboKitchen('Кофе', { id: 'k2', status: 'served', skipKitchen: true }),
      ],
      [comboSession()],
      { includeDone: true },
    )

    expect(rows[0].total).toBe(1)
    expect(rows[0].ids).toEqual(['k1'])
  })

  it('cancelled блюдо комбо исключается из агрегации', () => {
    const rows = run(
      [
        comboKitchen('Сырник', { id: 'k1', status: 'queued' }),
        comboKitchen('Кофе', { id: 'k2', status: 'cancelled' }),
      ],
      [comboSession()],
      { includeDone: true },
    )

    expect(rows[0].total).toBe(1)
    expect(rows[0].ids).toEqual(['k1'])
  })

  it('child-разбивка для поповера: имя + статус блюд', () => {
    const rows = run(
      [
        comboKitchen('Сырник', { id: 'k1', status: 'done' }),
        comboKitchen('Кофе', { id: 'k2', status: 'queued' }),
      ],
      [comboSession()],
      { includeDone: true },
    )

    const names = rows[0].children.map((c) => c.dishName).sort()

    expect(names).toEqual(['Кофе', 'Сырник'])
    const syrnik = rows[0].children.find((c) => c.dishName === 'Сырник')!

    expect(syrnik.status).toBe('done')
  })
})
