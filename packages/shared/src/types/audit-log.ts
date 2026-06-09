export type AuditLogFieldDiff = {
  old: unknown
  new: unknown
}

export type AuditLog = {
  id: string
  tenantId: string
  actorId: string | null
  actorName: string | null
  actorRole: string | null
  action: string
  entityType: string
  entityId: string | null
  entityName: string | null
  // Для action='updated' значения — AuditLogFieldDiff ({old,new}); для created/deleted пусто.
  payload: Record<string, unknown>
  changedFields: string[]
  parentType: string | null
  parentId: string | null
  createdAt: string
}
