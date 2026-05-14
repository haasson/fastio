import type { AddAuditLogParams, AuditLog } from '@fastio/shared'
import { useAuthStore } from '~/shared/stores/auth'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import { reportError } from '~/shared/utils/reportError'
import type { AuditLogsListParams } from '../api/audit-logs'
import { isAuditLogEnabled } from '~/shared/utils/featureFlags'

type LogParams = Omit<AddAuditLogParams, 'tenantId' | 'actorId' | 'actorName' | 'actorRole'>

export const useAuditLog = () => {
  const api = useDatabase()
  const authStore = useAuthStore()
  const tenantStore = useTenantStore()
  const enabled = isAuditLogEnabled()

  const log = (params: LogParams) => {
    if (!enabled) return
    if (!authStore.user) return

    api.auditLogs.add({
      tenantId: tenantStore.tenant.id,
      actorId: authStore.user.id,
      actorName: authStore.user.user_metadata?.full_name || authStore.user.email || null,
      actorRole: tenantStore.currentRoleName ?? null,
      ...params,
    }).catch(reportError)
  }

  const list = async (params: AuditLogsListParams = {}): Promise<AuditLog[]> => {
    if (!enabled) return []

    return api.auditLogs.list(tenantStore.tenant.id, params)
  }

  return { log, list }
}
