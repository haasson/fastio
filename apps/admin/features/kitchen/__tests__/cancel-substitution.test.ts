import { describe, it, expect } from 'vitest'
import type { KitchenQueueItem } from '@fastio/shared'
import { findSubstitute, isCancelledItemVisible } from '@fastio/shared'
import { mergeRealtimeItem } from '../api/kitchen-queue'

// Регрешн: отмена заказа с quantity>1 (дубли блюда) во время готовки не должна
// уносить карточку повара. Раньше findSubstitute матчил блюдо-близнеца из ТОГО ЖЕ
// отменяемого заказа → autoSubstitute удалял + dismiss'ил карточку. См. историю:
// заказ 17e6… (3× «Молочный коктейль»), баг воспроизводился вживую на demo-тенанте.
const ORDER = '17e6a122-50ff-44e2-8b2b-b020da09514a'
const OTHER_ORDER = 'ffffffff-0000-0000-0000-000000000099'
const DISH = '00000000-0000-0000-0005-000000000012'
const COOK = 'cook-1'

const row = (id: string, over: Partial<KitchenQueueItem> = {}): KitchenQueueItem => ({
  id,
  tenantId: 't',
  orderId: ORDER,
  orderNumber: 'A-1',
  orderItemId: 'oi-1',
  dishName: 'Молочный коктейль',
  dishId: DISH,
  comboId: null,
  comboName: null,
  categoryName: null,
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
  dismissedAt: null,
  skipKitchen: false,
  charged: false,
  createdAt: '2026-05-29T10:00:00Z',
  scheduledAt: null,
  kitchenLeadMinutes: null,
  ...over,
})

describe('findSubstitute: подмена не трогает свой же отменённый заказ', () => {
  it('НЕ матчит близнеца из того же заказа', () => {
    const cancelled = row('r1', { status: 'cancelled', assignedTo: COOK })
    const siblings = [row('r2'), row('r3')] // queued близнецы ТОГО ЖЕ заказа

    expect(findSubstitute(cancelled, siblings)).toBeNull()
  })

  it('по-прежнему матчит идентичное блюдо из ДРУГОГО активного заказа', () => {
    const cancelled = row('r1', { status: 'cancelled', assignedTo: COOK })
    const candidate = row('x1', { orderId: OTHER_ORDER }) // queued из другого заказа

    const match = findSubstitute(cancelled, [candidate])

    expect(match).not.toBeNull()
    expect(match!.type).toBe('exact')
    expect(match!.candidate.orderId).toBe(OTHER_ORDER)
  })
})

describe('Сценарий: отмена заказа Классик×3 во время готовки', () => {
  it('карточка повара выживает (перечёркнута), ничьи близнецы исчезают, подмены нет', () => {
    // зеркало логики queue.vue onUpdate (onBoard + isCancelledItemVisible)
    let items: KitchenQueueItem[] = [
      row('r1', { status: 'in_progress', assignedTo: COOK, assignedAt: 'x' }), // повар готовит
      row('r2'),
      row('r3'),
    ]
    const pending = new Map<string, unknown>()
    const dismissed: string[] = []
    const claimed: string[] = []

    const autoSubstitute = (cancelled: KitchenQueueItem, candidateId: string) => {
      const qi = items.find((i) => i.id === candidateId)

      if (qi) {
        qi.status = 'in_progress'
        qi.assignedTo = COOK
      }
      items = items.filter((i) => i.id !== cancelled.id)
      claimed.push(candidateId)
      dismissed.push(cancelled.id)
    }

    // зеркало queue.vue onUpdate: отменённые «ничьи»/dismissed снимаются с доски
    const onUpdate = (item: KitchenQueueItem) => {
      const onBoard = (item.status === 'queued' || item.status === 'in_progress')
        || (item.status === 'cancelled' && isCancelledItemVisible(item))

      if (onBoard) {
        const idx = items.findIndex((i) => i.id === item.id)

        if (idx !== -1) items[idx] = mergeRealtimeItem(item, items[idx])
        else items.push(item)

        if (item.status === 'cancelled' && item.assignedTo === COOK) {
          const reserved = new Set([...pending.keys()])
          const match = findSubstitute(item, items.filter((i) => i.status === 'queued' && !reserved.has(i.id)))

          if (match) {
            if (match.type === 'exact') autoSubstitute(item, match.candidate.id)
            else pending.set(item.id, match)
          }
        }
      } else {
        items = items.filter((i) => i.id !== item.id)
      }
    }

    // триггер kitchen_queue_on_order_cancel сделал bulk-UPDATE → 3 события (in_progress первым)
    onUpdate(row('r1', { status: 'cancelled', assignedTo: COOK }))
    onUpdate(row('r2', { status: 'cancelled', assignedTo: null }))
    onUpdate(row('r3', { status: 'cancelled', assignedTo: null }))

    // Ничего не подменялось и не дисмиссилось (близнецы — из того же заказа)
    expect(claimed).toHaveLength(0)
    expect(dismissed).toHaveLength(0)
    // Ничьи близнецы (r2/r3) исчезли с доски, осталась только карточка повара
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('r1')
    expect(items[0].status).toBe('cancelled')
    // Карточка повара (r1) видима в «Мои блюда»
    const cancelledOnBoard = items.filter(
      (i) => i.status === 'cancelled' && i.assignedTo === COOK && !pending.has(i.id),
    )

    expect(cancelledOnBoard.map((i) => i.id)).toContain('r1')
  })
})
