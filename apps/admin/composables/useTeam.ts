import { computed } from 'vue'
import type { TenantMember, TenantInvitation, TenantRole } from '@fastio/shared'
import { useQuery } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'
import { useSupabaseApi } from '~/composables/useSupabaseApi'

export const useTeam = () => {
  const api = useSupabaseApi()
  const tenantStore = useTenantStore()

  const { data, loading, execute: load } = useQuery(async () => {
    if (!tenantStore.currentTenantId) return null
    const { data } = await api.functions.listTeam({ tenantId: tenantStore.currentTenantId })

    return data as { members: TenantMember[]; invitations: TenantInvitation[] } | null
  })

  const members = computed<TenantMember[]>(() => data.value?.members ?? [])
  const invitations = computed<TenantInvitation[]>(() => data.value?.invitations ?? [])

  const invite = async (email: string, role: TenantRole, branchIds: string[] = []) => {
    if (!tenantStore.currentTenantId) return

    const { error } = await api.functions.inviteMember({
      tenantId: tenantStore.currentTenantId,
      email,
      role,
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

    await load()

    return { error: null, message: null }
  }

  const changeRole = async (memberId: string, role: TenantRole) => {
    await api.members.updateRole(memberId, role)
    await load()
  }

  const removeMember = async (memberId: string) => {
    await api.members.remove(memberId)
    await load()
  }

  const blockMember = async (memberId: string, blockedUntil: string) => {
    await api.members.block(memberId, blockedUntil)
    await load()
  }

  const unblockMember = async (memberId: string) => {
    await api.members.unblock(memberId)
    await load()
  }

  const cancelInvite = async (invitationId: string) => {
    await api.invitations.cancel(invitationId)
    await load()
  }

  const resendInvite = async (invitationId: string) => {
    const inv = invitations.value.find((i) => i.id === invitationId)

    if (!inv) return

    await api.functions.inviteMember({
      tenantId: inv.tenantId,
      email: inv.email,
      role: inv.role,
      branchIds: inv.branchIds,
      force: true,
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
    removeMember,
    blockMember,
    unblockMember,
    cancelInvite,
    resendInvite,
  }
}
