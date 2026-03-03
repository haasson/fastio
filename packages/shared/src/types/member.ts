export type TenantRole = 'owner' | 'admin' | 'manager' | 'staff'

export type TenantMember = {
  id: string
  tenantId: string
  userId: string
  role: TenantRole
  createdAt: string
  email?: string
  displayName?: string
}

export type TenantInvitation = {
  id: string
  tenantId: string
  email: string
  role: TenantRole
  invitedBy: string
  token: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

const ROLE_ORDER: TenantRole[] = ['owner', 'admin', 'manager', 'staff']

export function hasMinRole(userRole: TenantRole, requiredRole: TenantRole): boolean {
  return ROLE_ORDER.indexOf(userRole) <= ROLE_ORDER.indexOf(requiredRole)
}
