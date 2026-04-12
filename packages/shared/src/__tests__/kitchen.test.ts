import { describe, it, expect } from 'vitest'
import { isKitchenItemDone, getOrderPhase } from '../kitchen-helpers'
import type { KitchenQueueItem } from '../types/kitchen'

const makeItem = (overrides: Partial<KitchenQueueItem> = {}): KitchenQueueItem => ({
  id: 'kq-1',
  tenantId: 'tenant-1',
  orderId: 'order-1',
  orderNumber: null,
  orderItemId: 'oi-1',
  dishName: 'Бургер',
  dishId: 'dish-1',
  comboId: null,
  comboName: null,
  categoryName: 'Бургеры',
  modifiers: [],
  addons: [],
  removedIngredients: [],
  deliveryType: 'delivery',
  status: 'queued',
  assignedTo: null,
  assignedAt: null,
  completedAt: null,
  servedAt: null,
  servedBy: null,
  skipKitchen: false,
  createdAt: '2026-04-11T10:00:00Z',
  ...overrides,
})

// --- isKitchenItemDone ---

describe('isKitchenItemDone', () => {
  it('done → true', () => {
    expect(isKitchenItemDone(makeItem({ status: 'done' }))).toBe(true)
  })

  it('served → true', () => {
    expect(isKitchenItemDone(makeItem({ status: 'served' }))).toBe(true)
  })

  it('queued → false', () => {
    expect(isKitchenItemDone(makeItem({ status: 'queued' }))).toBe(false)
  })

  it('in_progress → false', () => {
    expect(isKitchenItemDone(makeItem({ status: 'in_progress' }))).toBe(false)
  })

  it('cancelled → false', () => {
    expect(isKitchenItemDone(makeItem({ status: 'cancelled' }))).toBe(false)
  })
})

// --- getOrderPhase ---

describe('getOrderPhase', () => {
  it('все блюда готовы → ready', () => {
    const items = [
      makeItem({ status: 'done' }),
      makeItem({ status: 'served' }),
    ]

    expect(getOrderPhase(items)).toBe('ready')
  })

  it('кухонные блюда готовы, skipKitchen ещё нет → collecting', () => {
    const items = [
      makeItem({ status: 'done', skipKitchen: false }),
      makeItem({ status: 'queued', skipKitchen: true }),
    ]

    expect(getOrderPhase(items)).toBe('collecting')
  })

  it('кухонные блюда не готовы → cooking', () => {
    const items = [
      makeItem({ status: 'in_progress', skipKitchen: false }),
      makeItem({ status: 'done', skipKitchen: true }),
    ]

    expect(getOrderPhase(items)).toBe('cooking')
  })

  it('все queued → cooking', () => {
    const items = [
      makeItem({ status: 'queued' }),
      makeItem({ status: 'queued' }),
    ]

    expect(getOrderPhase(items)).toBe('cooking')
  })

  it('микс: одно кухонное done, другое in_progress → cooking', () => {
    const items = [
      makeItem({ status: 'done', skipKitchen: false }),
      makeItem({ status: 'in_progress', skipKitchen: false }),
    ]

    expect(getOrderPhase(items)).toBe('cooking')
  })

  it('все skipKitchen и все done → ready', () => {
    const items = [
      makeItem({ status: 'done', skipKitchen: true }),
      makeItem({ status: 'done', skipKitchen: true }),
    ]

    expect(getOrderPhase(items)).toBe('ready')
  })

  it('все skipKitchen, не все done → collecting', () => {
    const items = [
      makeItem({ status: 'done', skipKitchen: true }),
      makeItem({ status: 'queued', skipKitchen: true }),
    ]

    // Кухонных блюд нет → kitchenDone = true (every на пустом = true),
    // но не все done → не ready → collecting
    expect(getOrderPhase(items)).toBe('collecting')
  })

  it('одно блюдо done → ready', () => {
    expect(getOrderPhase([makeItem({ status: 'done' })])).toBe('ready')
  })

  it('одно блюдо queued → cooking', () => {
    expect(getOrderPhase([makeItem({ status: 'queued' })])).toBe('cooking')
  })

  it('все блюда отменены → cancelled', () => {
    const items = [
      makeItem({ status: 'cancelled' }),
      makeItem({ status: 'cancelled' }),
    ]

    expect(getOrderPhase(items)).toBe('cancelled')
  })

  it('одно cancelled, другое done → ready', () => {
    const items = [
      makeItem({ status: 'cancelled' }),
      makeItem({ status: 'done' }),
    ]

    expect(getOrderPhase(items)).toBe('ready')
  })

  it('одно cancelled, другое in_progress → cooking', () => {
    const items = [
      makeItem({ status: 'cancelled' }),
      makeItem({ status: 'in_progress' }),
    ]

    expect(getOrderPhase(items)).toBe('cooking')
  })

  it('кухонное done, skipKitchen cancelled → ready (cancelled не блокирует)', () => {
    const items = [
      makeItem({ status: 'done', skipKitchen: false }),
      makeItem({ status: 'cancelled', skipKitchen: true }),
    ]

    expect(getOrderPhase(items)).toBe('ready')
  })
})
