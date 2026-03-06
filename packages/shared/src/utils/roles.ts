import type { TenantRole } from '../types/member'

const ROLE_ORDER: TenantRole[] = ['owner', 'admin', 'manager', 'staff']

export function hasMinRole(userRole: TenantRole, requiredRole: TenantRole): boolean {
  return ROLE_ORDER.indexOf(userRole) <= ROLE_ORDER.indexOf(requiredRole)
}
