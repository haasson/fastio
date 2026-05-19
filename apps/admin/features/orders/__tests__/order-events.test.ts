import { describe, it, expect } from 'vitest'
import { mapOrderEvent } from '../api/order-events'

const makeEventRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'event-1',
  order_id: 'order-1',
  tenant_id: 'tenant-1',
  actor_id: 'user-1',
  actor_name: 'Иван',
  actor_role: 'manager',
  event_type: 'status_changed',
  meta: { from: 'new', to: 'accepted' },
  created_at: '2026-03-15T10:00:00Z',
  ...overrides,
})

describe('mapOrderEvent', () => {
  it('маппит базовые поля', () => {
    const e = mapOrderEvent(makeEventRow())

    expect(e.id).toBe('event-1')
    expect(e.orderId).toBe('order-1')
    expect(e.tenantId).toBe('tenant-1')
    expect(e.actorId).toBe('user-1')
    expect(e.actorName).toBe('Иван')
    expect(e.actorRole).toBe('manager')
    expect(e.eventType).toBe('status_changed')
    expect(e.createdAt).toBe('2026-03-15T10:00:00Z')
  })

  it('meta маппится как объект', () => {
    const e = mapOrderEvent(makeEventRow({ meta: { from: 'new', to: 'accepted' } }))

    expect(e.meta).toEqual({ from: 'new', to: 'accepted' })
  })

  it('meta пустой объект — маппится', () => {
    const e = mapOrderEvent(makeEventRow({ meta: {} }))

    expect(e.meta).toEqual({})
  })

  it('actor_id null — маппится', () => {
    const e = mapOrderEvent(makeEventRow({ actor_id: null }))

    expect(e.actorId).toBeNull()
  })

  it('actor_name null — маппится', () => {
    const e = mapOrderEvent(makeEventRow({ actor_name: null }))

    expect(e.actorName).toBeNull()
  })

  it('actor_role null — маппится', () => {
    const e = mapOrderEvent(makeEventRow({ actor_role: null }))

    expect(e.actorRole).toBeNull()
  })

  it('разные event_type маппятся корректно', () => {
    const types = ['status_changed', 'item_added', 'item_removed', 'note_added', 'created']

    for (const eventType of types) {
      const e = mapOrderEvent(makeEventRow({ event_type: eventType }))

      expect(e.eventType).toBe(eventType)
    }
  })
})
