import { computed } from 'vue'
import type { TenantMember, TenantInvitation } from '@fastio/shared'
import { useQuery } from '@fastio/kit'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'

export const useTeam = () => {
  const api = useDatabase()
  const tenantStore = useTenantStore()

  const { data, loading, execute: load } = useQuery(async () => {
    if (!tenantStore.currentTenantId) return null
    // Edge function возвращает унифицированный envelope:
    //   200 → { success: true, members, invitations }
    //   4xx/5xx → { success: false, error, code }
    const { data, error } = await api.functions.listTeam({ tenantId: tenantStore.currentTenantId })

    if (error || !data?.success) return null

    return data as { success: true; members: TenantMember[]; invitations: TenantInvitation[] }
  })

  const members = computed<TenantMember[]>(() => data.value?.members ?? [])
  const invitations = computed<TenantInvitation[]>(() => data.value?.invitations ?? [])

  const invite = async (email: string, roleId: string, branchIds: string[] = []) => {
    if (!tenantStore.currentTenantId) return

    // Edge function возвращает унифицированный envelope:
    //   200 → { success: true, message }
    //   4xx/5xx → { success: false, error, code }
    // На non-2xx supabase-js кидает `error` с context.json() — оттуда читаем envelope.
    const { error } = await api.functions.inviteMember({
      tenantId: tenantStore.currentTenantId,
      email,
      roleId,
      branchIds,
    })

    if (error) {
      let message = 'Не удалось отправить приглашение'
      let code: string | null = null

      try {
        const body = await (error as {
          context?: { json?: () => Promise<{ error?: string; code?: string }> }
        }).context?.json?.()

        if (body?.error) message = body.error
        if (body?.code) code = body.code
      } catch { /* ignore parse errors */ }

      return { error, message, code }
    }

    await load()

    return { error: null, message: null, code: null }
  }

  const changeRole = async (memberId: string, roleId: string) => {
    await api.members.updateRole(memberId, roleId)
    await load()
  }

  const updateRoleAndBranches = async (memberId: string, roleId: string, branchIds: string[]) => {
    await api.members.updateRoleAndBranches(memberId, roleId, branchIds)
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
      roleId: inv.roleId!,
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
    updateRoleAndBranches,
    removeMember,
    blockMember,
    unblockMember,
    cancelInvite,
    resendInvite,
  }
}
