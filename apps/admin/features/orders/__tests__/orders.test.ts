import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrderItem } from '@fastio/shared'
import { mapOrder, ordersApi } from '../api/orders'

const makeOrderRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'order-1',
  tenant_id: 'tenant-1',
  customer_name: 'Иван',
  customer_phone: '79991234567',
  customer_email: null,
  order_items: [],
  delivery_type: 'delivery',
  address: 'ул. Ленина 1',
  comment: null,
  promo_code: null,
  discount_amount: 0,
  subtotal: 500,
  delivery_fee: 100,
  total: 600,
  status: 'new',
  payment_type: 'cash',
  branch_id: null,
  delivery_zone_id: null,
  table_id: null,
  table_name: null,
  order_number: null,
  accepted_by: null,
  created_at: '2026-03-15T10:00:00Z',
  updated_at: '2026-03-15T10:00:00Z',
  ...overrides,
})

describe('mapOrder', () => {
  it('маппит поля из snake_case в camelCase', () => {
    const order = mapOrder(makeOrderRow())

    expect(order.id).toBe('order-1')
    expect(order.tenantId).toBe('tenant-1')
    expect(order.customerName).toBe('Иван')
    expect(order.customerPhone).toBe('79991234567')
    expect(order.deliveryType).toBe('delivery')
    expect(order.discountAmount).toBe(0)
    expect(order.deliveryFee).toBe(100)
    expect(order.total).toBe(600)
    expect(order.createdAt).toBe('2026-03-15T10:00:00Z')
    expect(order.updatedAt).toBe('2026-03-15T10:00:00Z')
  })

  it('order_items маппятся в items', () => {
    const row = makeOrderRow({
      order_items: [{
        id: 'item-1',
        order_id: 'order-1',
        dish_id: 'dish-1',
        combo_id: null,
        dish_name: 'Пицца',
        category_name: 'Пиццы',
        price: 300,
        quantity: 2,
        removed_ingredients: [],
        modifiers: [],
        addons: [],
        sort_order: 0,
        completed_at: null,
        combo_items: null,
        added_by: null,
        confirmed_by: null,
        status: 'confirmed',
      }],
    })
    const order = mapOrder(row)

    expect(order.items).toHaveLength(1)
    expect(order.items[0].dishName).toBe('Пицца')
    expect(order.items[0].quantity).toBe(2)
    expect(order.items[0].price).toBe(300)
  })

  it('order_items null → пустой массив', () => {
    const order = mapOrder(makeOrderRow({ order_items: null }))

    expect(order.items).toEqual([])
  })

  it('order_items undefined → пустой массив', () => {
    const order = mapOrder(makeOrderRow({ order_items: undefined }))

    expect(order.items).toEqual([])
  })

  it('order_number null → null', () => {
    const order = mapOrder(makeOrderRow({ order_number: null }))

    expect(order.orderNumber).toBeNull()
  })

  it('маппит order_number если есть', () => {
    const order = mapOrder(makeOrderRow({ order_number: '#42' }))

    expect(order.orderNumber).toBe('#42')
  })

  it('item маппит modifiers и addons', () => {
    const row = makeOrderRow({
      order_items: [{
        id: 'item-1',
        order_id: 'order-1',
        dish_id: 'dish-1',
        combo_id: null,
        dish_name: 'Бургер',
        category_name: null,
        price: 400,
        quantity: 1,
        removed_ingredients: ['огурцы'],
        modifiers: [{ optionId: 'opt-1', optionName: 'Острый', priceDelta: 50 }],
        addons: [{ addonId: 'add-1', addonName: 'Соус', price: 30 }],
        sort_order: 0,
        completed_at: null,
        combo_items: null,
        added_by: null,
        confirmed_by: null,
        status: 'confirmed',
      }],
    })
    const item = mapOrder(row).items[0]

    expect(item.removedIngredients).toEqual(['огурцы'])
    expect(item.modifiers[0].optionName).toBe('Острый')
    expect(item.addons[0].addonName).toBe('Соус')
  })
})

const makeItem = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  dishId: 'dish-1',
  comboId: null,
  dishName: 'Бургер',
  categoryName: 'Бургеры',
  price: 300,
  quantity: 2,
  removedIngredients: ['лук'],
  modifiers: [{ optionId: 'opt-1', groupName: 'Острота', optionName: 'Острый', priceDelta: 50 }],
  addons: [{ addonId: 'add-1', addonName: 'Соус', price: 30 }],
  customizable: undefined,
  completedAt: null,
  comboItems: null,
  addedBy: null,
  confirmedBy: null,
  status: 'confirmed',
  ...overrides,
})

describe('ordersApi.addItems', () => {
  it('зовёт rpc add_items_to_order с корректным маппингом полей', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const sb = { rpc } as unknown as SupabaseClient

    await ordersApi.addItems(sb, 'order-1', [makeItem()])

    expect(rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = rpc.mock.calls[0]

    expect(fn).toBe('add_items_to_order')
    expect(args.p_order_id).toBe('order-1')
    expect(args.p_items_json).toEqual([{
      dish_name: 'Бургер',
      price: 300,
      quantity: 2,
      dish_id: 'dish-1',
      combo_id: null,
      combo_items: null,
      category_name: 'Бургеры',
      removed_ingredients: ['лук'],
      modifiers: [{ optionId: 'opt-1', groupName: 'Острота', optionName: 'Острый', priceDelta: 50 }],
      addons: [{ addonId: 'add-1', addonName: 'Соус', price: 30 }],
    }])
  })

  it('локализует ошибку rpc (42501 → Недостаточно прав)', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { code: '42501', message: 'Permission denied' } })
    const sb = { rpc } as unknown as SupabaseClient

    await expect(ordersApi.addItems(sb, 'order-1', [makeItem()])).rejects.toThrow('Недостаточно прав')
  })
})

const makeItemRow = (kitchenQueue?: { status: string }[]): Record<string, unknown> => ({
  id: 'item-1',
  order_id: 'order-1',
  dish_id: 'dish-1',
  combo_id: null,
  dish_name: 'Бургер',
  category_name: 'Бургеры',
  price: 300,
  quantity: 1,
  removed_ingredients: [],
  modifiers: [],
  addons: [],
  customizable: null,
  sort_order: 0,
  completed_at: null,
  combo_items: null,
  added_by: null,
  confirmed_by: null,
  status: 'confirmed',
  ...(kitchenQueue ? { kitchen_queue: kitchenQueue } : {}),
})

describe('mapOrder kitchenLocked', () => {
  it('false, если все тикеты queued', () => {
    const row = makeOrderRow({ order_items: [makeItemRow([{ status: 'queued' }, { status: 'queued' }])] })

    expect(mapOrder(row).items[0].kitchenLocked).toBe(false)
  })

  it('true, если хоть один тикет не queued', () => {
    const row = makeOrderRow({ order_items: [makeItemRow([{ status: 'queued' }, { status: 'in_progress' }])] })

    expect(mapOrder(row).items[0].kitchenLocked).toBe(true)
  })

  it('false, если kitchen_queue отсутствует (списочный запрос без join)', () => {
    const row = makeOrderRow({ order_items: [makeItemRow()] })

    expect(mapOrder(row).items[0].kitchenLocked).toBe(false)
  })

  it('false для cancelled-тикетов (после отмены+реактивации не блокируют)', () => {
    const row = makeOrderRow({ order_items: [makeItemRow([{ status: 'cancelled' }, { status: 'queued' }])] })

    expect(mapOrder(row).items[0].kitchenLocked).toBe(false)
  })

  it('true для done/served', () => {
    const done = makeOrderRow({ order_items: [makeItemRow([{ status: 'done' }])] })
    const served = makeOrderRow({ order_items: [makeItemRow([{ status: 'served' }])] })

    expect(mapOrder(done).items[0].kitchenLocked).toBe(true)
    expect(mapOrder(served).items[0].kitchenLocked).toBe(true)
  })
})

describe('ordersApi.removeOrderItem / updateItem', () => {
  it('removeOrderItem зовёт rpc remove_order_item', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const sb = { rpc } as unknown as SupabaseClient

    await ordersApi.removeOrderItem(sb, 'item-1')

    expect(rpc).toHaveBeenCalledWith('remove_order_item', { p_order_item_id: 'item-1' })
  })

  it('updateItem зовёт rpc update_order_item с маппингом полей', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const sb = { rpc } as unknown as SupabaseClient

    await ordersApi.updateItem(sb, 'item-1', makeItem({ quantity: 5 }))

    const [fn, args] = rpc.mock.calls[0]

    expect(fn).toBe('update_order_item')
    expect(args.p_order_item_id).toBe('item-1')
    expect(args.p_item_json.quantity).toBe(5)
    expect(args.p_item_json.dish_name).toBe('Бургер')
  })

  it('локализует ошибку «already being cooked»', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { code: 'P0001', message: 'Item already being cooked' } })
    const sb = { rpc } as unknown as SupabaseClient

    await expect(ordersApi.removeOrderItem(sb, 'item-1')).rejects.toThrow('готов')
  })

  it('локализует 42501 как «Недостаточно прав»', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { code: '42501', message: 'Permission denied' } })
    const sb = { rpc } as unknown as SupabaseClient

    await expect(ordersApi.removeOrderItem(sb, 'item-1')).rejects.toThrow('Недостаточно прав')
  })
})
