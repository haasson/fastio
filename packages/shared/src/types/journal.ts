export type JournalSource = 'audit' | 'order'

export type JournalEvent = {
  id: string
  source: JournalSource
  eventType: string          // action ('updated') or order event_type ('status_changed')
  occurredAt: string
  branchId: string | null    // null = общее (tenant-wide)
  actorId: string | null
  actorName: string | null
  entityType: string
  entityId: string
  entityName: string | null
  payload: Record<string, unknown>
  changedFields: string[]    // [] for order events; populated for audit
}
