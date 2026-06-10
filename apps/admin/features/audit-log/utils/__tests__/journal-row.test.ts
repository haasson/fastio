import { describe, it, expect } from 'vitest'
import type { JournalEvent } from '@fastio/shared'
import { branchBadge, toJournalRow } from '../journal-row'

const makeEvent = (over: Partial<JournalEvent> = {}): JournalEvent => ({
  id: 'e1',
  source: 'audit',
  eventType: 'updated',
  occurredAt: '2026-06-10T10:00:00Z',
  branchId: null,
  actorId: 'u1',
  actorName: 'Иван',
  entityType: 'dish',
  entityId: 'd1',
  entityName: 'Борщ',
  payload: { price: { old: 100, new: 120 } },
  changedFields: ['price'],
  ...over,
})

describe('branchBadge', () => {
  const names = new Map([['b1', 'Центр'], ['b2', 'Север']])

  it('null → «Всё заведение» (shared)', () => {
    expect(branchBadge(null, names)).toEqual({ label: 'Всё заведение', shared: true })
  })

  it('известный филиал → имя из словаря', () => {
    expect(branchBadge('b1', names)).toEqual({ label: 'Центр', shared: false })
  })

  it('неизвестный id → «Филиал» (не падает)', () => {
    expect(branchBadge('zzz', names)).toEqual({ label: 'Филиал', shared: false })
  })
})

describe('toJournalRow', () => {
  const names = new Map([['b1', 'Центр']])

  it('маппит JournalEvent в форму AuditLog с бейджами', () => {
    const row = toJournalRow(makeEvent({ branchId: 'b1' }), names, 't1')

    expect(row.id).toBe('e1')
    expect(row.tenantId).toBe('t1')
    expect(row.createdAt).toBe('2026-06-10T10:00:00Z')
    expect(row.action).toBe('updated')
    expect(row.entityName).toBe('Борщ')
    expect(row.changedFields).toEqual(['price'])
    expect(row.payload).toEqual({ price: { old: 100, new: 120 } })
    expect(row.actorRole).toBeNull()
    expect(row.branchBadge).toEqual({ label: 'Центр', shared: false })
    // конфиг-строки не несут changeSummary — колонка «Изменения» рендерит их через renderChanges
    expect(row.changeSummary).toBeUndefined()
  })

  it('order-событие (delivery): нормализованный action + сводка из payload._order_event в changeSummary', () => {
    const row = toJournalRow(
      makeEvent({
        source: 'order',
        // SQL нормализует event_type → 'updated' для status_changed; mapper его просто прокидывает.
        eventType: 'updated',
        // Объект приходит из SQL: delivery-заказ → entity_type 'order', entity_name = номер.
        entityType: 'order',
        entityName: '№123',
        branchId: null,
        changedFields: [],
        // SQL сташит сырой тип в payload._order_event.
        payload: { _order_event: 'status_changed', from_name: 'Новый', to_name: 'Готов' },
      }),
      names,
      't1',
    )

    expect(row.action).toBe('updated')
    expect(row.entityType).toBe('order')
    expect(row.entityName).toBe('№123')
    expect(row.changeSummary).toBe('Новый → Готов')
    expect(row.branchBadge).toEqual({ label: 'Всё заведение', shared: true })
  })

  it('order-событие (dine-in): объект = стол, action created (order_created)', () => {
    const row = toJournalRow(
      makeEvent({
        source: 'order',
        eventType: 'created',
        // dine-in: SQL отдаёт entity_type 'table' + имя стола.
        entityType: 'table',
        entityName: 'Стол 5',
        branchId: 'b1',
        changedFields: [],
        payload: { _order_event: 'order_created', source: 'admin' },
      }),
      names,
      't1',
    )

    expect(row.action).toBe('created')
    expect(row.entityType).toBe('table')
    expect(row.entityName).toBe('Стол 5')
    // changeSummary строится из сырого order_created.
    expect(row.changeSummary).toBeTruthy()
  })

  it('order-событие без _order_event: changeSummary падает на eventType', () => {
    const row = toJournalRow(
      makeEvent({ source: 'order', eventType: 'updated', entityType: 'order', branchId: null, changedFields: [], payload: {} }),
      names,
      't1',
    )

    expect(row.changeSummary).toBe('updated')
  })
})
