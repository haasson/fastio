import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useAuthStore } from './auth'
import { useTenant } from '~/shared/data/useTenant'

export const useTenantStore = defineStore('tenant', () => {
  const authStore = useAuthStore()
  const userId = computed(() => authStore.user?.id ?? null)

  const tenantApi = useTenant(userId)

  return {
    memberships: tenantApi.memberships,
    currentTenantId: tenantApi.currentTenantId,
    tenant: tenantApi.tenant,
    maybeTenant: tenantApi.maybeTenant,
    tenantId: tenantApi.tenantId,
    timezone: tenantApi.timezone,
    businessType: tenantApi.businessType,
    isServices: tenantApi.isServices,
    isRetail: tenantApi.isRetail,
    loading: tenantApi.loading,
    currentRoleName: tenantApi.currentRoleName,
    currentPermissions: tenantApi.currentPermissions,
    isOwner: tenantApi.isOwner,
    roles: tenantApi.roles,
    rolesLoading: tenantApi.rolesLoading,
    loadRoles: tenantApi.loadRoles,
    createRole: tenantApi.createRole,
    updateRole: tenantApi.updateRole,
    removeRole: tenantApi.removeRole,
    getRoleById: tenantApi.getRoleById,
    hasMultipleTenants: tenantApi.hasMultipleTenants,
    partialInitFailures: tenantApi.partialInitFailures,
    init: tenantApi.init,
    fetchTenant: tenantApi.fetchTenant,
    update: tenantApi.update,
    changePlan: tenantApi.changePlan,
    activatePlan: tenantApi.activatePlan,
    switchTenant: tenantApi.switchTenant,
    dispose: tenantApi.dispose,
  }
})
