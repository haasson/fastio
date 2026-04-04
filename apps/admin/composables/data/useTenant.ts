import { ref, computed, type Ref } from 'vue'
import type { Tenant, RolePermissions } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useRealtimeWatch } from '~/composables/data/useRealtimeWatch'
import { usePlans } from '~/composables/plan/usePlans'
import { useModuleConfigs } from '~/composables/plan/useModules'
import { useRoles } from '~/composables/data/useRoles'

type MembershipWithTenant = {
  id: string
  tenantId: string
  userId: string
  roleId: string | null
  roleName: string | null
  permissions: RolePermissions
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

  const rolesApi = useRoles(currentTenantId)

  const currentMembership = computed(() => {
    if (!currentTenantId.value) return null

    return memberships.value.find((m) => m.tenantId === currentTenantId.value) ?? null
  })

  const isOwner = computed(() => currentMembership.value?.roleId === null && currentMembership.value !== null)

  const currentPermissions = computed<RolePermissions | null>(() => currentMembership.value?.permissions ?? null)

  const currentRoleName = computed<string | null>(() => {
    if (isOwner.value) return 'Владелец'

    return currentMembership.value?.roleName ?? null
  })

  const hasMultipleTenants = computed(() => memberships.value.length > 1)

  let lastFetchAt = 0

  const fetchTenant = async () => {
    if (!currentTenantId.value) return
    tenant.value = await api.tenants.getById(currentTenantId.value)
    lastFetchAt = Date.now()
  }

  useRealtimeWatch('tenants', currentTenantId, {
    onUpdate: () => {
      if (Date.now() - lastFetchAt < 2000) return
      fetchTenant()
    },
  })

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

    const { load: loadPlans } = usePlans()
    const { load: loadConfigs } = useModuleConfigs()

    await Promise.all([fetchTenant(), loadPlans(), loadConfigs(), rolesApi.load()])
    loading.value = false
  }

  const switchTenant = async (tenantId: string) => {
    if (tenantId === currentTenantId.value) return

    loading.value = true
    currentTenantId.value = tenantId
    localStorage.setItem(STORAGE_KEY, tenantId)

    await Promise.all([fetchTenant(), rolesApi.load()])
    loading.value = false
  }

  const update = async (data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt' | 'subscription' | 'balance'>>) => {
    if (!tenant.value) return

    const snapshot = tenant.value

    tenant.value = { ...tenant.value, ...data }

    try {
      await api.tenants.update(snapshot.id, data)
    } catch {
      tenant.value = snapshot
      throw new Error('Не удалось сохранить изменения')
    }
  }

  const dispose = () => {
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
    currentRoleName,
    currentPermissions,
    isOwner,
    roles: rolesApi.roles,
    rolesLoading: rolesApi.loading,
    loadRoles: rolesApi.load,
    createRole: rolesApi.create,
    updateRole: rolesApi.update,
    removeRole: rolesApi.remove,
    getRoleById: rolesApi.getRoleById,
    hasMultipleTenants,
    init,
    fetchTenant,
    switchTenant,
    update,
    dispose,
  }
}
