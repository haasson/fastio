export type PermissionKey =
  | 'menu.view' | 'menu.edit' | 'menu.delete'
  | 'orders.view' | 'orders.create' | 'orders.edit' | 'orders.status' | 'orders.cancel'
  | 'kitchen.view' | 'kitchen.overview'
  | 'tables.view' | 'tables.manage'
  | 'appointments.view' | 'appointments.manage'
  | 'appointments.view_all' | 'appointments.view_own'
  | 'promos.view' | 'promos.manage'
  | 'content.view' | 'content.edit'
  | 'team.view' | 'team.manage'
  | 'roles.manage'
  | 'settings.view' | 'settings.edit'
  | 'audit_log.view'
  | 'analytics.view'
  | 'billing.manage'

export type RolePermissions = Partial<Record<PermissionKey, boolean>>

export type TenantCustomRole = {
  id: string
  tenantId: string
  name: string
  permissions: RolePermissions
  isDefault: boolean
  createdAt: string
  updatedAt: string
}
