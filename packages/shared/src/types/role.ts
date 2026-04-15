export type PermissionKey =
  | 'menu.view' | 'menu.edit' | 'menu.delete'
  | 'orders.view' | 'orders.create' | 'orders.edit' | 'orders.status' | 'orders.cancel'
  | 'kitchen.view' | 'kitchen.overview'
  | 'tables.view' | 'tables.manage'
  | 'reservations.view' | 'reservations.manage'
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
