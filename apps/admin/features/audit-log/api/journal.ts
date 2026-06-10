import type { SupabaseClient } from '@supabase/supabase-js'
import type { JournalEvent } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import type { JournalEventRow } from '~/shared/data/db-types'

export type JournalListParams = {
  branchId?: string | null
  before?: string | null
  beforeId?: string | null
  sources?: string[]
  entityTypes?: string[]
  eventTypes?: string[]
  search?: string
  limit?: number
}

export const mapJournalEvent = (row: JournalEventRow): JournalEvent => ({
  id: row.id,
  source: row.source,
  eventType: row.event_type,
  occurredAt: row.occurred_at,
  branchId: row.branch_id ?? null,
  actorId: row.actor_id ?? null,
  actorName: row.actor_name ?? null,
  entityType: row.entity_type,
  entityId: row.entity_id ?? '',
  entityName: row.entity_name ?? null,
  payload: row.payload ?? {},
  changedFields: row.changed_fields ?? [],
})

export const journalApi = {
  async list(sb: SupabaseClient, tenantId: string, params: JournalListParams = {}): Promise<JournalEvent[]> {
    const { data, error } = await sb.rpc('journal_events', {
      p_tenant_id: tenantId,
      p_branch_id: params.branchId ?? null,
      p_before: params.before ?? null,
      p_before_id: params.beforeId ?? null,
      p_sources: params.sources ?? null,
      p_entity_types: params.entityTypes ?? null,
      p_event_types: params.eventTypes ?? null,
      p_search: params.search ?? null,
      p_limit: params.limit ?? 50,
    })

    if (error) {
      reportError(error, { context: 'journalApi.list' })

      throw new Error('Не удалось загрузить журнал')
    }

    return (data ?? []).map(mapJournalEvent)
  },
}
