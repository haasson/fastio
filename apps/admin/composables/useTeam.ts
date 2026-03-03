import type { TenantMember, TenantInvitation, TenantRole } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

export function useTeam() {
  const { $supabase } = useNuxtApp()
  const tenantStore = useTenantStore()

  const members = ref<TenantMember[]>([])
  const invitations = ref<TenantInvitation[]>([])
  const loading = ref(false)

  async function load() {
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

  async function invite(email: string, role: TenantRole) {
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

  async function changeRole(memberId: string, role: TenantRole) {
    await membersApi.updateRole($supabase, memberId, role)
    await load()
  }

  async function removeMember(memberId: string) {
    await membersApi.remove($supabase, memberId)
    await load()
  }

  async function cancelInvite(invitationId: string) {
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
