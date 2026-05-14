import { useRuntimeConfig } from '#imports'

export const isAuditLogEnabled = (): boolean => {
  const config = useRuntimeConfig()

  return Boolean(config.public.auditLogEnabled)
}
