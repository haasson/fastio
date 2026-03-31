import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'

export const usePermissions = () => {
  const tenantStore = useTenantStore()

  const can = (key: string) => computed(() => {
    if (tenantStore.isOwner) return true
    const perms = tenantStore.currentPermissions

    return perms?.[key as keyof typeof perms] === true
  })

  return {
    // Menu
    canViewMenu: can('menu.view'),
    canManageMenu: can('menu.edit'),
    canDeleteMenuItems: can('menu.delete'),
    // Orders
    canViewOrders: can('orders.view'),
    canCreateOrders: can('orders.create'),
    canEditOrders: can('orders.edit'),
    canChangeOrderStatus: can('orders.status'),
    canCancelOrders: can('orders.cancel'),
    canManageOrders: can('orders.view'),
    // Kitchen
    canViewKitchen: can('kitchen.view'),
    // Tables
    canViewTables: can('tables.view'),
    canManageTables: can('tables.manage'),
    // Reservations
    canViewReservations: can('reservations.view'),
    canManageReservations: can('reservations.manage'),
    // Promos
    canViewPromotions: can('promos.view'),
    canManagePromotions: can('promos.manage'),
    // Content & site
    canViewContent: can('content.view'),
    canEditContent: can('content.edit'),
    // Team
    canViewTeam: can('team.view'),
    canManageTeam: can('team.manage'),
    canManageRoles: can('roles.manage'),
    // Settings
    canViewSettings: can('settings.view'),
    canEditSettings: can('settings.edit'),
    // Analytics
    canViewAnalytics: can('analytics.view'),
    // Billing
    canManageBilling: can('billing.manage'),
    // Owner-only
    canDeleteTenant: computed(() => tenantStore.isOwner),
    // Generic check
    can,
  }
}
