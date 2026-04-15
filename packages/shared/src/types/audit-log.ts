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
  payload: Record<string, unknown>
  createdAt: string
}

export type AddAuditLogParams = Omit<AuditLog, 'id' | 'createdAt'>
