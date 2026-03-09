import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useAuthStore } from './auth'
import { useBranchStore } from './branch'
import { useTenant } from '~/composables/useTenant'

export const useTenantStore = defineStore('tenant', () => {
  const authStore = useAuthStore()
  const userId = computed(() => authStore.user?.id ?? null)

  const tenantApi = useTenant(userId)

  // switchTenant и dispose перехватываем в сторе, чтобы синхронно сбросить
  // branchStore перед сменой тенанта — без круговой зависимости в composable
  const switchTenant = async (tenantId: string) => {
    const branchStore = useBranchStore()

    branchStore.dispose()
    await tenantApi.switchTenant(tenantId)
  }

  const dispose = () => {
    const branchStore = useBranchStore()

    branchStore.dispose()
    tenantApi.dispose()
  }

  return {
    memberships: tenantApi.memberships,
    currentTenantId: tenantApi.currentTenantId,
    tenant: tenantApi.tenant,
    loading: tenantApi.loading,
    currentRole: tenantApi.currentRole,
    hasMultipleTenants: tenantApi.hasMultipleTenants,
    init: tenantApi.init,
    update: tenantApi.update,
    switchTenant,
    dispose,
  }
})
