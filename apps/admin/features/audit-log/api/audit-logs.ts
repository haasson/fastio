import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditLog } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import { reportError } from '@fastio/shared/observability'
import type { AuditLogRow } from '~/shared/data/db-types'

export type AuditLogsListParams = {
  entityType?: string
  entityId?: string
  action?: string
  actorId?: string
  changedField?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

export type AuditLogsForEntityParams = {
  entityType: string
  entityId: string
  includeChildren?: boolean
  limit?: number
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
    changedFields: row.changed_fields ?? [],
    parentType: row.parent_type ?? null,
    parentId: row.parent_id ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export type AuditLogsListResult = {
  logs: AuditLog[]
  total: number
}

export const auditLogsApi = {
  // Возвращает страницу записей + общее количество (count: 'exact') для пагинации.
  async list(sb: SupabaseClient, tenantId: string, params: AuditLogsListParams = {}): Promise<AuditLogsListResult> {
    const limit = params.limit ?? 100
    const offset = params.offset ?? 0

    let q = sb
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (params.entityType) q = q.eq('entity_type', params.entityType)
    if (params.entityId) q = q.eq('entity_id', params.entityId)
    if (params.action) q = q.eq('action', params.action)
    if (params.actorId) q = q.eq('actor_id', params.actorId)
    if (params.changedField) q = q.contains('changed_fields', [params.changedField])
    if (params.search) q = q.ilike('search_text', `%${params.search}%`)
    if (params.dateFrom) q = q.gte('created_at', params.dateFrom)
    if (params.dateTo) q = q.lte('created_at', params.dateTo)

    const { data, error, count } = await q

    if (error) {
      console.error('[Supabase]', error.message, error)
      reportError(error, { context: 'audit-logs-list' })

      throw new Error('Не удалось загрузить журнал действий')
    }

    return {
      logs: (data ?? []).map(mapAuditLog),
      total: count ?? 0,
    }
  },

  // История одной сущности для встроенной панели (AuditTrail).
  // includeChildren — подмешивает события дочерних записей (parent_type/parent_id).
  async listForEntity(sb: SupabaseClient, tenantId: string, params: AuditLogsForEntityParams): Promise<AuditLog[]> {
    let q = sb
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(params.limit ?? 50)

    if (params.includeChildren) {
      q = q.or(
        `and(entity_type.eq.${params.entityType},entity_id.eq.${params.entityId}),`
        + `and(parent_type.eq.${params.entityType},parent_id.eq.${params.entityId})`,
      )
    } else {
      q = q.eq('entity_type', params.entityType).eq('entity_id', params.entityId)
    }

    const data = await query(q)

    return (data ?? []).map(mapAuditLog)
  },
}
