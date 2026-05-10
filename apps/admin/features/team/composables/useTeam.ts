import { computed } from 'vue'
import type { TenantMember, TenantInvitation } from '@fastio/shared'
import { useQuery } from '@fastio/kit'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/composables/data/useDatabase'
import { useAuditLog } from '~/features/audit-log'

export const useTeam = () => {
  const api = useDatabase()
  const tenantStore = useTenantStore()
  const { log } = useAuditLog()

  const { data, loading, execute: load } = useQuery(async () => {
    if (!tenantStore.currentTenantId) return null
    const { data } = await api.functions.listTeam({ tenantId: tenantStore.currentTenantId })

    return data as { members: TenantMember[]; invitations: TenantInvitation[] } | null
  })

  const members = computed<TenantMember[]>(() => data.value?.members ?? [])
  const invitations = computed<TenantInvitation[]>(() => data.value?.invitations ?? [])

  const invite = async (email: string, roleId: string, branchIds: string[] = []) => {
    if (!tenantStore.currentTenantId) return

    const { error } = await api.functions.inviteMember({
      tenantId: tenantStore.currentTenantId,
      email,
      roleId,
      branchIds,
    })

    if (error) {
      let message = 'Не удалось отправить приглашение'

      try {
        const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.()

        if (body?.error) message = body.error
      } catch { /* ignore parse errors */ }

      return { error, message }
    }

    log({
      action: 'member.invite',
      entityType: 'member',
      entityId: null,
      entityName: email,
      payload: { email, roleId, branchIds },
    })

    await load()

    return { error: null, message: null }
  }

  const changeRole = async (memberId: string, roleId: string) => {
    const member = members.value.find((m) => m.id === memberId)

    await api.members.updateRole(memberId, roleId)
    log({
      action: 'member.role_change',
      entityType: 'member',
      entityId: memberId,
      entityName: member?.displayName ?? member?.email ?? null,
      payload: { oldRoleId: member?.roleId ?? null, oldRoleName: member?.roleName ?? null, newRoleId: roleId },
    })
    await load()
  }

  const updateRoleAndBranches = async (memberId: string, roleId: string, branchIds: string[]) => {
    const member = members.value.find((m) => m.id === memberId)

    await api.members.updateRoleAndBranches(memberId, roleId, branchIds)
    log({
      action: 'member.role_change',
      entityType: 'member',
      entityId: memberId,
      entityName: member?.displayName ?? member?.email ?? null,
      payload: { oldRoleId: member?.roleId ?? null, oldRoleName: member?.roleName ?? null, newRoleId: roleId, branchIds },
    })
    await load()
  }

  const removeMember = async (memberId: string) => {
    const member = members.value.find((m) => m.id === memberId)

    await api.members.remove(memberId)
    log({
      action: 'member.remove',
      entityType: 'member',
      entityId: memberId,
      entityName: member?.displayName ?? member?.email ?? null,
      payload: { roleId: member?.roleId ?? null, roleName: member?.roleName ?? null },
    })
    await load()
  }

  const blockMember = async (memberId: string, blockedUntil: string) => {
    const member = members.value.find((m) => m.id === memberId)

    await api.members.block(memberId, blockedUntil)
    log({
      action: 'member.block',
      entityType: 'member',
      entityId: memberId,
      entityName: member?.displayName ?? member?.email ?? null,
      payload: { blockedUntil },
    })
    await load()
  }

  const unblockMember = async (memberId: string) => {
    const member = members.value.find((m) => m.id === memberId)

    await api.members.unblock(memberId)
    log({
      action: 'member.unblock',
      entityType: 'member',
      entityId: memberId,
      entityName: member?.displayName ?? member?.email ?? null,
      payload: {},
    })
    await load()
  }

  const cancelInvite = async (invitationId: string) => {
    const inv = invitations.value.find((i) => i.id === invitationId)

    await api.invitations.cancel(invitationId)
    log({
      action: 'member.invite_cancel',
      entityType: 'member',
      entityId: invitationId,
      entityName: inv?.email ?? null,
      payload: { email: inv?.email ?? null, roleId: inv?.roleId ?? null },
    })
    await load()
  }

  const resendInvite = async (invitationId: string) => {
    const inv = invitations.value.find((i) => i.id === invitationId)

    if (!inv) return

    await api.functions.inviteMember({
      tenantId: inv.tenantId,
      email: inv.email,
      roleId: inv.roleId!,
      branchIds: inv.branchIds,
      force: true,
    })
    log({
      action: 'member.invite_resend',
      entityType: 'member',
      entityId: invitationId,
      entityName: inv.email,
      payload: { email: inv.email },
    })
    await load()
  }

  return {
    members,
    invitations,
    loading,
    load,
    invite,
    changeRole,
    updateRoleAndBranches,
    removeMember,
    blockMember,
    unblockMember,
    cancelInvite,
    resendInvite,
  }
}
