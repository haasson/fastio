import { ref, computed, type Ref } from 'vue'
import type { Tenant, TenantRole } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useRealtimeWatch } from '~/composables/data/useRealtimeWatch'

type MembershipWithTenant = {
  id: string
  tenantId: string
  userId: string
  role: TenantRole
  branchIds: string[]
  tenant: { id: string; name: string; slug: string } | null
}

const STORAGE_KEY = 'fastio_current_tenant'

export const useTenant = (userId: Ref<string | null>) => {
  const api = useDatabase()

  const memberships = ref<MembershipWithTenant[]>([])
  const currentTenantId = ref<string | null>(null)
  const tenant = ref<Tenant | null>(null)
  const loading = ref(false)

  const currentRole = computed<TenantRole | null>(() => {
    if (!currentTenantId.value) return null
    const m = memberships.value.find((m) => m.tenantId === currentTenantId.value)

    return m?.role ?? null
  })

  const hasMultipleTenants = computed(() => memberships.value.length > 1)

  const fetchTenant = async () => {
    if (!currentTenantId.value) return
    tenant.value = await api.tenants.getById(currentTenantId.value)
  }

  useRealtimeWatch('tenants', currentTenantId, { onUpdate: () => fetchTenant() })

  const init = async () => {
    if (!userId.value) return

    loading.value = true

    const data = await api.members.listByUser(userId.value)

    memberships.value = data

    if (memberships.value.length === 0) {
      loading.value = false

      return
    }

    const savedId = localStorage.getItem(STORAGE_KEY)
    const savedExists = savedId && memberships.value.some((m) => m.tenantId === savedId)

    currentTenantId.value = savedExists ? savedId : memberships.value[0].tenantId

    await fetchTenant()
    loading.value = false
  }

  const switchTenant = async (tenantId: string) => {
    if (tenantId === currentTenantId.value) return

    loading.value = true
    currentTenantId.value = tenantId
    localStorage.setItem(STORAGE_KEY, tenantId)

    await fetchTenant()
    loading.value = false
  }

  const update = async (data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) => {
    if (!tenant.value) return

    await api.tenants.update(tenant.value.id, data)
    tenant.value = { ...tenant.value, ...data }
  }

  const dispose = () => {
    tenant.value = null
    memberships.value = []
    currentTenantId.value = null // реактивно отписывает useRealtimeWatch
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
}
