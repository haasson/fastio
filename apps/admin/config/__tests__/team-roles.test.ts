import { describe, it, expect } from 'vitest'
import type { PermissionKey } from '@fastio/shared'
import { permissionGroups } from '../team-roles'
import { AUDIT_LOG_ENABLED } from '../../utils/featureFlags'

// Все PermissionKey — должны быть в sync с типом
const ALL_PERMISSION_KEYS: PermissionKey[] = [
  'menu.view', 'menu.edit', 'menu.delete',
  'orders.view', 'orders.create', 'orders.edit', 'orders.status', 'orders.cancel',
  'kitchen.view', 'kitchen.overview',
  'tables.view', 'tables.manage',
  'reservations.view', 'reservations.manage',
  'appointments.view', 'appointments.manage',
  'promos.view', 'promos.manage',
  'content.view', 'content.edit',
  'team.view', 'team.manage',
  'roles.manage',
  'settings.view', 'settings.edit',
  ...(AUDIT_LOG_ENABLED ? ['audit_log.view' as PermissionKey] : []),
  'analytics.view',
  'billing.manage',
]

describe('permissionGroups config', () => {
  it('каждый PermissionKey присутствует ровно в одной группе', () => {
    const allKeysInGroups = permissionGroups.flatMap((g) => g.permissions.map((p) => p.key))

    for (const key of ALL_PERMISSION_KEYS) {
      const count = allKeysInGroups.filter((k) => k === key).length

      expect(count, `${key} should appear exactly once in permissionGroups, found ${count}`).toBe(1)
    }
  })

  it('в группах нет лишних ключей', () => {
    const allKeysInGroups = permissionGroups.flatMap((g) => g.permissions.map((p) => p.key))

    for (const key of allKeysInGroups) {
      expect(
        ALL_PERMISSION_KEYS.includes(key),
        `${key} in permissionGroups but not in PermissionKey type`,
      ).toBe(true)
    }
  })

  it('каждая группа имеет label и хотя бы один пермишен', () => {
    for (const group of permissionGroups) {
      expect(group.label.length).toBeGreaterThan(0)
      expect(group.permissions.length).toBeGreaterThan(0)
    }
  })

  it('каждый пермишен имеет label', () => {
    for (const group of permissionGroups) {
      for (const perm of group.permissions) {
        expect(perm.label.length, `${perm.key} should have a label`).toBeGreaterThan(0)
      }
    }
  })
})
