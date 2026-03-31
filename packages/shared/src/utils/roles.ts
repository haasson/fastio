import type { PermissionKey, RolePermissions } from '../types/role'

/**
 * Check if permissions object has a specific permission enabled.
 * Owner (null roleId) should be checked separately — this only checks the permissions map.
 */
export function hasPermission(permissions: RolePermissions | null, key: PermissionKey): boolean {
  if (!permissions) return false
  return permissions[key] === true
}
