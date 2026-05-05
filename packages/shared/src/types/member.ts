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

// `token` НЕ ВКЛЮЧЕН в публичный тип специально (SE5): любой member с team.manage
// видит инвайты тенанта, и отдавать живой `token` в API response =
// потенциальная утечка через Sentry/Network tab. Эта аутентификационная
// тайна должна жить только внутри edge functions accept-invite/get-invite,
// которые сами читают её из tenant_invitations по hash из URL.
export type TenantInvitation = {
  id: string
  tenantId: string
  email: string
  roleId: string | null
  roleName: string | null
  invitedBy: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
  branchIds: string[]
}
