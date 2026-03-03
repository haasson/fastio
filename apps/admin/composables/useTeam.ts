import { ref } from 'vue'
import { useNuxtApp } from '#imports'
import type { TenantMember, TenantInvitation, TenantRole } from '@fastio/shared'
import { membersApi } from '~/utils/api/members'
import { invitationsApi } from '~/utils/api/invitations'
import { useTenantStore } from '~/stores/tenant'

export const useTeam = () => {
  const { $supabase } = useNuxtApp()
  const tenantStore = useTenantStore()

  const members = ref<TenantMember[]>([])
  const invitations = ref<TenantInvitation[]>([])
  const loading = ref(false)

  const load = async () => {
    if (!tenantStore.currentTenantId) return

    loading.value = true

    const { data } = await $supabase.functions.invoke('list-team', {
      body: { tenantId: tenantStore.currentTenantId },
    })

    if (data) {
      members.value = data.members ?? []
      invitations.value = data.invitations ?? []
    }

    loading.value = false
  }

  const invite = async (email: string, role: TenantRole) => {
    if (!tenantStore.currentTenantId) return

    const { error } = await $supabase.functions.invoke('invite-member', {
      body: {
        tenantId: tenantStore.currentTenantId,
        email,
        role,
      },
    })

    if (!error) await load()

    return { error }
  }

  const changeRole = async (memberId: string, role: TenantRole) => {
    await membersApi.updateRole($supabase, memberId, role)
    await load()
  }

  const removeMember = async (memberId: string) => {
    await membersApi.remove($supabase, memberId)
    await load()
  }

  const cancelInvite = async (invitationId: string) => {
    await invitationsApi.cancel($supabase, invitationId)
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
