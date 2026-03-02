import { defineStore } from 'pinia'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Tenant } from '@fastio/shared'
import { useAuthStore } from './auth'

export const useTenantStore = defineStore('tenant', () => {
  const tenant = ref<Tenant | null>(null)
  const loading = ref(false)
  let channel: RealtimeChannel | null = null

  async function init() {
    const { $supabase } = useNuxtApp()
    const authStore = useAuthStore()

    if (!authStore.user) return

    loading.value = true

    async function fetchTenant() {
      tenant.value = await tenantsApi.getByOwner($supabase, authStore.user!.id)
      loading.value = false
    }

    await fetchTenant()

    if (tenant.value) {
      channel = $supabase
        .channel(`tenant:${tenant.value.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${tenant.value.id}`,
        }, () => fetchTenant())
        .subscribe()
    }
  }

  async function update(data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) {
    if (!tenant.value) return
    const { $supabase } = useNuxtApp()
    await tenantsApi.update($supabase, tenant.value.id, data)
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
    tenant.value = null
  }

  return { tenant, loading, init, update, dispose }
})
