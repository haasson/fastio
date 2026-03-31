import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RolePermissions, PermissionKey } from '@fastio/shared'
import { usePermissions } from '../auth/usePermissions'

const mockStore: {
  isOwner: boolean
  currentPermissions: RolePermissions | null
} = {
  isOwner: false,
  currentPermissions: null,
}

vi.mock('~/stores/tenant', () => ({
  useTenantStore: () => mockStore,
}))

// Дефолтные роли — эталонные наборы пермишенов
const DEFAULT_ROLES: Record<string, RolePermissions> = {
  'Администратор': {
    'menu.view': true, 'menu.edit': true, 'menu.delete': true,
    'orders.view': true, 'orders.create': true, 'orders.edit': true, 'orders.status': true, 'orders.cancel': true,
    'kitchen.view': true,
    'tables.view': true, 'tables.manage': true,
    'reservations.view': true, 'reservations.manage': true,
    'promos.view': true, 'promos.manage': true,
    'content.view': true, 'content.edit': true,
    'team.view': true, 'team.manage': true, 'roles.manage': true,
    'settings.view': true, 'settings.edit': true,
    'analytics.view': true,
  },
  'Менеджер зала': {
    'menu.view': true,
    'orders.view': true, 'orders.create': true, 'orders.edit': true, 'orders.status': true, 'orders.cancel': true,
    'kitchen.view': true,
    'tables.view': true, 'tables.manage': true,
    'reservations.view': true, 'reservations.manage': true,
  },
  'Кассир': {
    'menu.view': true,
    'orders.view': true, 'orders.create': true, 'orders.edit': true, 'orders.status': true,
  },
  'Повар': {
    'menu.view': true,
    'kitchen.view': true,
  },
  'Хостес': {
    'orders.view': true,
    'tables.view': true,
    'reservations.view': true, 'reservations.manage': true,
  },
  'Контент-менеджер': {
    'menu.view': true, 'menu.edit': true, 'menu.delete': true,
    'promos.view': true, 'promos.manage': true,
    'content.view': true, 'content.edit': true,
  },
}

// Все возможные пермишены
const ALL_PERMISSIONS: PermissionKey[] = [
  'menu.view', 'menu.edit', 'menu.delete',
  'orders.view', 'orders.create', 'orders.edit', 'orders.status', 'orders.cancel',
  'kitchen.view',
  'tables.view', 'tables.manage',
  'reservations.view', 'reservations.manage',
  'promos.view', 'promos.manage',
  'content.view', 'content.edit',
  'team.view', 'team.manage',
  'roles.manage',
  'settings.view', 'settings.edit',
  'analytics.view',
  'billing.manage',
]

describe('usePermissions', () => {
  beforeEach(() => {
    mockStore.isOwner = false
    mockStore.currentPermissions = null
  })

  describe('owner видит всё', () => {
    it('все пермишены возвращают true', () => {
      mockStore.isOwner = true
      const perms = usePermissions()

      for (const key of ALL_PERMISSIONS) {
        expect(perms.can(key).value, `owner should have ${key}`).toBe(true)
      }
    })

    it('canDeleteTenant = true', () => {
      mockStore.isOwner = true
      expect(usePermissions().canDeleteTenant.value).toBe(true)
    })
  })

  describe('пользователь без роли ничего не видит', () => {
    it('все пермишены false', () => {
      mockStore.currentPermissions = null
      const perms = usePermissions()

      for (const key of ALL_PERMISSIONS) {
        expect(perms.can(key).value, `null perms should not have ${key}`).toBe(false)
      }
    })

    it('canDeleteTenant = false', () => {
      expect(usePermissions().canDeleteTenant.value).toBe(false)
    })
  })

  describe.each(Object.entries(DEFAULT_ROLES))('роль "%s"', (roleName, rolePerms) => {
    beforeEach(() => {
      mockStore.isOwner = false
      mockStore.currentPermissions = rolePerms
    })

    it('имеет только разрешённые пермишены', () => {
      const perms = usePermissions()

      for (const key of ALL_PERMISSIONS) {
        const expected = rolePerms[key] === true

        expect(
          perms.can(key).value,
          `${roleName}: ${key} should be ${expected}`,
        ).toBe(expected)
      }
    })

    it('canDeleteTenant = false', () => {
      expect(usePermissions().canDeleteTenant.value).toBe(false)
    })
  })

  describe('навигационные алиасы корректны', () => {
    it('canManageMenu = menu.edit', () => {
      mockStore.currentPermissions = { 'menu.edit': true }
      expect(usePermissions().canManageMenu.value).toBe(true)
    })

    it('canManageOrders = orders.view', () => {
      mockStore.currentPermissions = { 'orders.view': true }
      expect(usePermissions().canManageOrders.value).toBe(true)
    })

    it('canViewKitchen = kitchen.view', () => {
      mockStore.currentPermissions = { 'kitchen.view': true }
      expect(usePermissions().canViewKitchen.value).toBe(true)
    })

    it('canViewTables = tables.view', () => {
      mockStore.currentPermissions = { 'tables.view': true }
      expect(usePermissions().canViewTables.value).toBe(true)
    })

    it('canViewReservations = reservations.view', () => {
      mockStore.currentPermissions = { 'reservations.view': true }
      expect(usePermissions().canViewReservations.value).toBe(true)
    })

    it('canViewContent = content.view', () => {
      mockStore.currentPermissions = { 'content.view': true }
      expect(usePermissions().canViewContent.value).toBe(true)
    })

    it('canEditContent = content.edit', () => {
      mockStore.currentPermissions = { 'content.edit': true }
      expect(usePermissions().canEditContent.value).toBe(true)
    })

    it('canManageTeam = team.manage', () => {
      mockStore.currentPermissions = { 'team.manage': true }
      expect(usePermissions().canManageTeam.value).toBe(true)
    })

    it('canManageRoles = roles.manage', () => {
      mockStore.currentPermissions = { 'roles.manage': true }
      expect(usePermissions().canManageRoles.value).toBe(true)
    })
  })
})
