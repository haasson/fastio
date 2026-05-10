import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditLog, AddAuditLogParams } from '@fastio/shared'
import { query } from '~/utils/query'
import type { AuditLogRow } from '~/utils/api/db-types'

export type AuditLogsListParams = {
  entityType?: string
  entityId?: string
  limit?: number
  offset?: number
}

const mapAuditLog = (raw: Record<string, unknown>): AuditLog => {
  const row = raw as AuditLogRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  }
}

export const auditLogsApi = {
  async list(sb: SupabaseClient, tenantId: string, params: AuditLogsListParams = {}): Promise<AuditLog[]> {
    let q = sb
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(params.limit ?? 100)

    if (params.entityType) q = q.eq('entity_type', params.entityType)
    if (params.entityId) q = q.eq('entity_id', params.entityId)
    if (params.offset) q = q.range(params.offset, params.offset + (params.limit ?? 100) - 1)

    const data = await query(q)

    return (data ?? []).map(mapAuditLog)
  },

  async add(sb: SupabaseClient, params: AddAuditLogParams): Promise<void> {
    await query(
      sb.from('audit_logs').insert({
        tenant_id: params.tenantId,
        actor_id: params.actorId,
        actor_name: params.actorName,
        actor_role: params.actorRole,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName,
        payload: params.payload,
      }),
    )
  },
}
