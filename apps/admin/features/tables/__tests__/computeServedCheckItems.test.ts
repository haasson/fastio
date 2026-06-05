import { describe, it, expect } from 'vitest'
import type { KitchenQueueItem } from '@fastio/shared'
import { computeServedCheckItems } from '../utils/computeServedCheckItems'
import type { TableSessionItem } from '../api/tables'

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

const makeItem = (overrides: Partial<TableSessionItem> = {}): TableSessionItem => ({
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

describe('computeServedCheckItems — обычные блюда', () => {
  it('блюдо целиком на кухне — не в чеке', () => {
    const result = computeServedCheckItems(
      [makeItem({ quantity: 1 })],
      [makeKitchen({ status: 'in_progress' })],
    )

    expect(result).toHaveLength(0)
  })

  it('частично подано (3 заказано, 1 ещё готовится) — в чеке 2', () => {
    const result = computeServedCheckItems(
      [makeItem({ quantity: 3 })],
      [makeKitchen({ status: 'queued' })],
    )

    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(2)
  })

  it('блюдо без кухонных строк (skip_kitchen) — в чеке целиком', () => {
    const result = computeServedCheckItems([makeItem({ quantity: 2 })], [])

    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(2)
  })

  it('pending-позиции игнорируются', () => {
    const result = computeServedCheckItems(
      [makeItem({ status: 'pending', quantity: 5 })],
      [],
    )

    expect(result).toHaveLength(0)
  })
})

describe('computeServedCheckItems — комбо (фикс двоения)', () => {
  const comboItem = () => makeItem({ dishName: 'Комбо Завтрак', dishId: 'combo-1', price: 450 })

  const comboKitchen = (dishName: string, over: Partial<KitchenQueueItem> = {}) => makeKitchen({
    orderItemId: 'combo-oi',
    comboId: 'combo-1',
    comboName: 'Комбо Завтрак',
    dishName,
    ...over,
  })

  it('комбо ещё на кухне — НЕ в чеке (раньше двоилось)', () => {
    const result = computeServedCheckItems(
      [comboItem()],
      [
        comboKitchen('Сырник', { id: 'k1', status: 'done' }),
        comboKitchen('Кофе', { id: 'k2', status: 'in_progress' }),
      ],
    )

    expect(result).toHaveLength(0)
  })

  it('комбо полностью подано (все строки served) — в чеке', () => {
    const result = computeServedCheckItems(
      [comboItem()],
      [
        comboKitchen('Сырник', { id: 'k1', status: 'served' }),
        comboKitchen('Кофе', { id: 'k2', status: 'served' }),
      ],
    )

    expect(result).toHaveLength(1)
    expect(result[0].dishName).toBe('Комбо Завтрак')
  })

  it('дети комбо не загрязняют учёт одноимённого отдельного блюда', () => {
    // отдельный Сырник подан (нет своих кухонных строк), но на кухне активен
    // Сырник ИЗ комбо — он не должен прятать отдельный Сырник из чека.
    const result = computeServedCheckItems(
      [makeItem({ dishName: 'Сырник', quantity: 1 })],
      [comboKitchen('Сырник', { id: 'k1', status: 'queued' })],
    )

    expect(result).toHaveLength(1)
    expect(result[0].dishName).toBe('Сырник')
  })
})
