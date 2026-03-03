import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useNuxtApp } from '#imports'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Tenant, TenantRole } from '@fastio/shared'
import { tenantsApi } from '~/utils/api/tenants'
import { membersApi } from '~/utils/api/members'
import { useAuthStore } from './auth'

type MembershipWithTenant = {
  id: string
  tenantId: string
  userId: string
  role: TenantRole
  tenant: { id: string; name: string; slug: string } | null
}

const STORAGE_KEY = 'fastio_current_tenant'

export const useTenantStore = defineStore('tenant', () => {
  const memberships = ref<MembershipWithTenant[]>([])
  const currentTenantId = ref<string | null>(null)
  const tenant = ref<Tenant | null>(null)
  const loading = ref(false)
  let channel: RealtimeChannel | null = null

  const currentRole = computed<TenantRole | null>(() => {
    if (!currentTenantId.value) return null
    const m = memberships.value.find((m) => m.tenantId === currentTenantId.value)

    return m?.role ?? null
  })

  const hasMultipleTenants = computed(() => memberships.value.length > 1)

  const fetchTenant = async () => {
    if (!currentTenantId.value) return
    const { $supabase } = useNuxtApp()

    tenant.value = await tenantsApi.getById($supabase, currentTenantId.value)
  }

  const subscribeToTenant = () => {
    if (!currentTenantId.value) return
    const { $supabase } = useNuxtApp()

    channel?.unsubscribe()
    channel = $supabase
      .channel(`tenant:${currentTenantId.value}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tenants',
        filter: `id=eq.${currentTenantId.value}`,
      }, () => fetchTenant())
      .subscribe()
  }

  const init = async () => {
    const { $supabase } = useNuxtApp()
    const authStore = useAuthStore()

    if (!authStore.user) return

    loading.value = true

    const data = await membersApi.listByUser($supabase, authStore.user.id)

    memberships.value = data

    if (memberships.value.length === 0) {
      loading.value = false

      return
    }

    const savedId = localStorage.getItem(STORAGE_KEY)
    const savedExists = savedId && memberships.value.some((m) => m.tenantId === savedId)

    currentTenantId.value = savedExists ? savedId : memberships.value[0].tenantId

    await fetchTenant()
    subscribeToTenant()
    loading.value = false
  }

  const switchTenant = async (tenantId: string) => {
    if (tenantId === currentTenantId.value) return

    currentTenantId.value = tenantId
    localStorage.setItem(STORAGE_KEY, tenantId)

    channel?.unsubscribe()
    loading.value = true
    await fetchTenant()
    subscribeToTenant()
    loading.value = false
  }

  const update = async (data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) => {
    if (!tenant.value) return
    const { $supabase } = useNuxtApp()

    await tenantsApi.update($supabase, tenant.value.id, data)
  }

  const dispose = () => {
    channel?.unsubscribe()
    channel = null
    tenant.value = null
    memberships.value = []
    currentTenantId.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    memberships,
    currentTenantId,
    tenant,
    loading,
    currentRole,
    hasMultipleTenants,
    init,
    switchTenant,
    update,
    dispose,
  }
})
