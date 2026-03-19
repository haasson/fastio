import type { IconName } from '@fastio/icons'
import type { TenantModules } from '@fastio/shared'

export type ModuleKey = keyof TenantModules

export type ModuleConfig = {
  key: ModuleKey
  name: string
  description: string
  icon: IconName
  requiredPlan: string
  sortOrder: number
}
