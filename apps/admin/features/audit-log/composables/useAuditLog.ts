import type { AuditLog } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import type { AuditLogsListParams, AuditLogsForEntityParams, AuditLogsListResult } from '../api/audit-logs'
import { isAuditLogEnabled } from '~/shared/utils/featureFlags'

// Только ЧТЕНИЕ. Запись в audit_logs идёт БД-триггерами (fn_audit, миграция 321),
// ручного логирования из фронта нет — иначе двойная запись.
export const useAuditLog = () => {
  const api = useDatabase()
  const tenantStore = useTenantStore()
  const enabled = isAuditLogEnabled()

  const list = async (params: AuditLogsListParams = {}): Promise<AuditLogsListResult> => {
    if (!enabled) return { logs: [], total: 0 }

    return api.auditLogs.list(tenantStore.tenant.id, params)
  }

  const listForEntity = async (params: AuditLogsForEntityParams): Promise<AuditLog[]> => {
    if (!enabled) return []

    return api.auditLogs.listForEntity(tenantStore.tenant.id, params)
  }

  return { list, listForEntity, enabled }
}
