import { ref, computed, type Ref } from 'vue'
import type { Tenant, RolePermissions } from '@fastio/shared'
import { DEFAULT_TIMEZONE } from '@fastio/shared'
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
  const maybeTenant = ref<Tenant | null>(null)
  const loading = ref(false)

  const rolesApi = useRoles(currentTenantId)

  /**
   * Non-nullable tenant для защищённых роутов. После `init()` и до `dispose()`
   * гарантирован middleware'ом. На публичных страницах (login/invite/
   * set-password/no-access/legal) и во время init — используй `maybeTenant`,
   * иначе в dev упадёт с понятной ошибкой, в проде — TypeError при чтении полей.
   */
  const tenant = computed<Tenant>(() => {
    if (import.meta.dev && !maybeTenant.value) {
      throw new Error(
        '[useTenant] tenant прочитан, но не загружен. Используй maybeTenant на публичных роутах '
        + '(login/invite/set-password/no-access/legal/*) или дождись окончания init().',
      )
    }

    return maybeTenant.value as Tenant
  })

  const tenantId = computed<string>(() => tenant.value.id)
  const timezone = computed<string>(() => maybeTenant.value?.timezone ?? DEFAULT_TIMEZONE)
  const businessType = computed(() => tenant.value.businessType)
  const isServices = computed(() => tenant.value.businessType === 'services')
  const isRetail = computed(() => tenant.value.businessType === 'retail')

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
    maybeTenant.value = await api.tenants.getById(currentTenantId.value)
    lastFetchAt = Date.now()
  }

  useRealtimeWatch('tenants', currentTenantId, {
    onUpdate: (row) => {
      if (Date.now() - lastFetchAt < 2000) return

      const newPlan = (row.subscription as Record<string, unknown> | null)?.plan
      const currentPlan = maybeTenant.value?.subscription?.plan

      if (newPlan !== currentPlan) {
        window.location.reload()

        return
      }

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
    if (!maybeTenant.value) return

    const snapshot = maybeTenant.value

    maybeTenant.value = { ...snapshot, ...data }

    try {
      await api.tenants.update(snapshot.id, data)
    } catch {
      maybeTenant.value = snapshot
      throw new Error('Не удалось сохранить изменения')
    }
  }

  const changePlan = async (planKey: string): Promise<'upgraded' | 'downgraded'> => {
    if (!maybeTenant.value) throw new Error('No tenant')
    const result = await api.tenants.updatePlan(maybeTenant.value.id, planKey)

    await fetchTenant()

    return result
  }

  const dispose = () => {
    maybeTenant.value = null
    memberships.value = []
    currentTenantId.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    memberships,
    currentTenantId,
    tenant,
    maybeTenant,
    tenantId,
    timezone,
    businessType,
    isServices,
    isRetail,
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
    changePlan,
    dispose,
  }
}
