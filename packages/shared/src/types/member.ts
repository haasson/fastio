import type { RolePermissions } from './role'

export type TenantMember = {
  id: string
  tenantId: string
  userId: string
  roleId: string | null
  roleName: string | null
  permissions: RolePermissions
  branchIds: string[]
  blockedUntil?: string | null
  createdAt: string
  email?: string
  displayName?: string
  invitedBy?: string
}

export type TenantInvitation = {
  id: string
  tenantId: string
  email: string
  roleId: string | null
  roleName: string | null
  invitedBy: string
  token: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
  branchIds: string[]
}
