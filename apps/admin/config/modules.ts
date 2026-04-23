import type { IconName } from '@fastio/icons'
import type { BusinessType, MenuStyle, TenantModules } from '@fastio/shared'

export type ModuleKey = keyof TenantModules

export type ModuleConfig = {
  key: ModuleKey
  name: string
  description: string
  icon: IconName
  requiredPlan: string
  sortOrder: number
  businessTypes: BusinessType[]
  menuStyles: MenuStyle[] | null
}
