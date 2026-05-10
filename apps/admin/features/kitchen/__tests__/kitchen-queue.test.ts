import { describe, it, expect } from 'vitest'
import { mapKitchenQueueItem } from '../api/kitchen-queue'

const makeRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'kq-1',
  tenant_id: 'tenant-1',
  order_id: 'order-1',
  order_item_id: 'oi-1',
  dish_name: 'Бургер',
  dish_id: 'dish-1',
  combo_id: null,
  combo_name: null,
  category_name: 'Бургеры',
  modifiers: [{ groupId: 'g1', optionId: 'o1', name: 'Острый', price: 0 }],
  addons: [],
  removed_ingredients: ['Лук'],
  delivery_type: 'delivery',
  status: 'queued',
  assigned_to: null,
  assigned_at: null,
  completed_at: null,
  served_at: null,
  served_by: null,
  skip_kitchen: false,
  created_at: '2026-04-11T10:00:00Z',
  orders: { order_number: 'A-042' },
  ...overrides,
})

describe('mapKitchenQueueItem', () => {
  it('маппит snake_case → camelCase', () => {
    const item = mapKitchenQueueItem(makeRow())

    expect(item.id).toBe('kq-1')
    expect(item.tenantId).toBe('tenant-1')
    expect(item.orderId).toBe('order-1')
    expect(item.orderItemId).toBe('oi-1')
    expect(item.dishName).toBe('Бургер')
    expect(item.dishId).toBe('dish-1')
    expect(item.comboId).toBeNull()
    expect(item.comboName).toBeNull()
    expect(item.categoryName).toBe('Бургеры')
    expect(item.deliveryType).toBe('delivery')
    expect(item.status).toBe('queued')
    expect(item.assignedTo).toBeNull()
    expect(item.skipKitchen).toBe(false)
    expect(item.createdAt).toBe('2026-04-11T10:00:00Z')
  })

  it('orderNumber из join orders', () => {
    const item = mapKitchenQueueItem(makeRow({ orders: { order_number: 'B-123' } }))

    expect(item.orderNumber).toBe('B-123')
  })

  it('orderNumber null если orders нет', () => {
    const item = mapKitchenQueueItem(makeRow({ orders: null }))

    expect(item.orderNumber).toBeNull()
  })

  it('orderNumber null если order_number null', () => {
    const item = mapKitchenQueueItem(makeRow({ orders: { order_number: null } }))

    expect(item.orderNumber).toBeNull()
  })

  it('modifiers и addons маппятся as-is', () => {
    const mods = [{ groupId: 'g1', optionId: 'o1', name: 'Острый', price: 0 }]
    const addons = [{ id: 'a1', name: 'Сыр', price: 50 }]
    const item = mapKitchenQueueItem(makeRow({ modifiers: mods, addons }))

    expect(item.modifiers).toEqual(mods)
    expect(item.addons).toEqual(addons)
  })

  it('null modifiers/addons → пустые массивы', () => {
    const item = mapKitchenQueueItem(makeRow({ modifiers: null, addons: null, removed_ingredients: null }))

    expect(item.modifiers).toEqual([])
    expect(item.addons).toEqual([])
    expect(item.removedIngredients).toEqual([])
  })

  it('served_by маппится', () => {
    const item = mapKitchenQueueItem(makeRow({ served_by: 'user-1', served_at: '2026-04-11T11:00:00Z' }))

    expect(item.servedBy).toBe('user-1')
    expect(item.servedAt).toBe('2026-04-11T11:00:00Z')
  })
})
