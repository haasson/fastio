import { describe, it, expect } from 'vitest'
import { hasPermission } from '../utils/roles'
import type { RolePermissions } from '../types/role'

describe('hasPermission', () => {
  const managerPerms: RolePermissions = {
    'menu.view': true,
    'menu.edit': true,
    'orders.view': true,
  }

  it('возвращает true для включённого пермишена', () => {
    expect(hasPermission(managerPerms, 'menu.view')).toBe(true)
    expect(hasPermission(managerPerms, 'menu.edit')).toBe(true)
  })

  it('возвращает false для отсутствующего пермишена', () => {
    expect(hasPermission(managerPerms, 'settings.edit')).toBe(false)
    expect(hasPermission(managerPerms, 'team.manage')).toBe(false)
  })

  it('возвращает false для null permissions', () => {
    expect(hasPermission(null, 'menu.view')).toBe(false)
  })

  it('возвращает false для пустого объекта', () => {
    expect(hasPermission({}, 'menu.view')).toBe(false)
  })

  it('возвращает false если значение явно false', () => {
    const perms: RolePermissions = { 'menu.view': false }
    expect(hasPermission(perms, 'menu.view')).toBe(false)
  })
})
