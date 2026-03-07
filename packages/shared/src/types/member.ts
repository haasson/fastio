export type TenantRole = 'owner' | 'admin' | 'manager' | 'staff'

export type TenantMember = {
  id: string
  tenantId: string
  userId: string
  role: TenantRole
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
  role: TenantRole
  invitedBy: string
  token: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
  branchIds: string[]
}
