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
  'audit_log.view',
  'analytics.view',
  'billing.manage',
]

describe('usePermissions', () => {
  beforeEach(() => {
    mockStore.isOwner = false
    mockStore.currentPermissions = null
  })

  it('owner получает true для любого ключа', () => {
    mockStore.isOwner = true
    const { can } = usePermissions()

    for (const key of ALL_PERMISSIONS) {
      expect(can(key).value, `owner should have ${key}`).toBe(true)
    }
  })

  it('пользователь без прав получает false для любого ключа', () => {
    const { can } = usePermissions()

    for (const key of ALL_PERMISSIONS) {
      expect(can(key).value, `null perms should not have ${key}`).toBe(false)
    }
  })

  it('возвращает true только для разрешённых ключей', () => {
    mockStore.currentPermissions = { 'menu.view': true, 'orders.view': true }
    const { can } = usePermissions()

    expect(can('menu.view').value).toBe(true)
    expect(can('orders.view').value).toBe(true)
    expect(can('menu.edit').value).toBe(false)
    expect(can('settings.edit').value).toBe(false)
  })
})
