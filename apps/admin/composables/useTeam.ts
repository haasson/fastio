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

  const invite = async (email: string, role: TenantRole) => {
    if (!tenantStore.currentTenantId) return

    const { error } = await api.functions.inviteMember({
      tenantId: tenantStore.currentTenantId,
      email,
      role,
    })

    if (!error) await load()

    return { error }
  }

  const changeRole = async (memberId: string, role: TenantRole) => {
    await api.members.updateRole(memberId, role)
    await load()
  }

  const removeMember = async (memberId: string) => {
    await api.members.remove(memberId)
    await load()
  }

  const cancelInvite = async (invitationId: string) => {
    await api.invitations.cancel(invitationId)
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
    cancelInvite,
  }
}
