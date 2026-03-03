import { computed } from 'vue'
import { hasMinRole } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

export const usePermissions = () => {
  const tenantStore = useTenantStore()

  const canManageMenu = computed(() => !!tenantStore.currentRole && hasMinRole(tenantStore.currentRole, 'manager'),
  )

  const canManageOrders = computed(() => !!tenantStore.currentRole,
  )

  const canManagePromotions = computed(() => !!tenantStore.currentRole && hasMinRole(tenantStore.currentRole, 'manager'),
  )

  const canEditSettings = computed(() => !!tenantStore.currentRole && hasMinRole(tenantStore.currentRole, 'admin'),
  )

  const canViewSettings = computed(() => !!tenantStore.currentRole && hasMinRole(tenantStore.currentRole, 'manager'),
  )

  const canManageTeam = computed(() => !!tenantStore.currentRole && hasMinRole(tenantStore.currentRole, 'admin'),
  )

  const canDeleteTenant = computed(() => tenantStore.currentRole === 'owner',
  )

  return {
    canManageMenu,
    canManageOrders,
    canManagePromotions,
    canEditSettings,
    canViewSettings,
    canManageTeam,
    canDeleteTenant,
  }
}
