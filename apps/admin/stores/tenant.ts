import { defineStore } from 'pinia'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Tenant } from '@fastfood-saas/shared'
import { useAuthStore } from './auth'

function mapTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    slug: row.slug as string,
    customDomain: row.custom_domain as string | null,
    theme: row.theme as Tenant['theme'],
    contacts: row.contacts as Tenant['contacts'],
    workingHours: row.working_hours as Tenant['workingHours'],
    notifications: row.notifications as Tenant['notifications'],
    subscription: row.subscription as Tenant['subscription'],
    deliveryMinOrder: row.delivery_min_order as number,
    deliveryFee: row.delivery_fee as number,
    createdAt: row.created_at as string,
  }
}

function tenantToDb(data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) {
  return {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.slug !== undefined && { slug: data.slug }),
    ...(data.customDomain !== undefined && { custom_domain: data.customDomain }),
    ...(data.theme !== undefined && { theme: data.theme }),
    ...(data.contacts !== undefined && { contacts: data.contacts }),
    ...(data.workingHours !== undefined && { working_hours: data.workingHours }),
    ...(data.notifications !== undefined && { notifications: data.notifications }),
    ...(data.subscription !== undefined && { subscription: data.subscription }),
    ...(data.deliveryMinOrder !== undefined && { delivery_min_order: data.deliveryMinOrder }),
    ...(data.deliveryFee !== undefined && { delivery_fee: data.deliveryFee }),
  }
}

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
      const { data } = await $supabase
        .from('tenants')
        .select('*')
        .eq('owner_id', authStore.user!.id)
        .maybeSingle()

      tenant.value = data ? mapTenant(data) : null
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
    await $supabase.from('tenants').update(tenantToDb(data)).eq('id', tenant.value.id)
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
    tenant.value = null
  }

  return { tenant, loading, init, update, dispose }
})
