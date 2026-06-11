import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { JournalEventRow } from '~/shared/data/db-types'
import { mapJournalEvent, journalApi } from '../journal'

describe('mapJournalEvent', () => {
  it('мапит audit-строку (branchId null, changedFields заполнены)', () => {
    const row: JournalEventRow = {
      id: 'audit-1',
      source: 'audit',
      event_type: 'updated',
      occurred_at: '2026-06-10T10:00:00.000Z',
      branch_id: null,
      actor_id: 'user-1',
      actor_name: 'Иван',
      actor_email: 'ivan@example.com',
      entity_type: 'dish',
      entity_id: 'dish-42',
      entity_name: 'Бургер',
      payload: { before: { price: 100 }, after: { price: 120 } },
      changed_fields: ['price'],
    }

    expect(mapJournalEvent(row)).toEqual({
      id: 'audit-1',
      source: 'audit',
      eventType: 'updated',
      occurredAt: '2026-06-10T10:00:00.000Z',
      branchId: null,
      actorId: 'user-1',
      actorName: 'Иван',
      actorEmail: 'ivan@example.com',
      entityType: 'dish',
      entityId: 'dish-42',
      entityName: 'Бургер',
      payload: { before: { price: 100 }, after: { price: 120 } },
      changedFields: ['price'],
    })
  })

  it('мапит order-строку (branchId — uuid, payload/changedFields дефолтятся при null)', () => {
    const row: JournalEventRow = {
      id: 'order-evt-1',
      source: 'order',
      event_type: 'status_changed',
      occurred_at: '2026-06-10T11:30:00.000Z',
      branch_id: '11111111-2222-3333-4444-555555555555',
      actor_id: null,
      actor_name: null,
      actor_email: null,
      entity_type: 'order',
      entity_id: 'order-7',
      entity_name: null,
      payload: null,
      changed_fields: null,
    }

    expect(mapJournalEvent(row)).toEqual({
      id: 'order-evt-1',
      source: 'order',
      eventType: 'status_changed',
      occurredAt: '2026-06-10T11:30:00.000Z',
      branchId: '11111111-2222-3333-4444-555555555555',
      actorId: null,
      actorName: null,
      actorEmail: null,
      entityType: 'order',
      entityId: 'order-7',
      entityName: null,
      payload: {},
      changedFields: [],
    })
  })
})

describe('journalApi.list', () => {
  it('list() форвардит все параметры с дефолтами', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })

    await journalApi.list({ rpc } as unknown as SupabaseClient, 't-1')
    expect(rpc).toHaveBeenCalledWith('journal_events', {
      p_tenant_id: 't-1', p_branch_id: null, p_before: null, p_before_id: null,
      p_sources: null, p_entity_types: null, p_event_types: null, p_search: null, p_limit: 50,
      p_from: null, p_to: null,
    })
  })

  it('list() форвардит кастомные параметры как p_-эквиваленты (включая период from/to)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })

    await journalApi.list({ rpc } as unknown as SupabaseClient, 't-1', {
      branchId: 'b1', before: '2026-01-01T00:00:00Z', beforeId: 'x', eventTypes: ['deleted'], limit: 10,
      from: '2026-06-01T00:00:00Z', to: '2026-06-11T00:00:00Z',
    })
    expect(rpc).toHaveBeenCalledWith('journal_events', {
      p_tenant_id: 't-1', p_branch_id: 'b1', p_before: '2026-01-01T00:00:00Z', p_before_id: 'x',
      p_sources: null, p_entity_types: null, p_event_types: ['deleted'], p_search: null, p_limit: 10,
      p_from: '2026-06-01T00:00:00Z', p_to: '2026-06-11T00:00:00Z',
    })
  })
})
