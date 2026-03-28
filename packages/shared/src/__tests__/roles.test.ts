import { describe, it, expect } from 'vitest'
import { hasMinRole } from '../utils/roles'

describe('hasMinRole', () => {
  it('owner имеет доступ ко всем ролям', () => {
    expect(hasMinRole('owner', 'owner')).toBe(true)
    expect(hasMinRole('owner', 'admin')).toBe(true)
    expect(hasMinRole('owner', 'manager')).toBe(true)
    expect(hasMinRole('owner', 'staff')).toBe(true)
  })

  it('staff не имеет доступ к ролям выше', () => {
    expect(hasMinRole('staff', 'manager')).toBe(false)
    expect(hasMinRole('staff', 'admin')).toBe(false)
    expect(hasMinRole('staff', 'owner')).toBe(false)
  })

  it('одинаковые роли — доступ есть', () => {
    expect(hasMinRole('admin', 'admin')).toBe(true)
    expect(hasMinRole('manager', 'manager')).toBe(true)
    expect(hasMinRole('staff', 'staff')).toBe(true)
  })

  it('admin не имеет доступ к owner', () => {
    expect(hasMinRole('admin', 'owner')).toBe(false)
  })

  it('manager не имеет доступ к admin', () => {
    expect(hasMinRole('manager', 'admin')).toBe(false)
  })

  it('admin имеет доступ к manager и staff', () => {
    expect(hasMinRole('admin', 'manager')).toBe(true)
    expect(hasMinRole('admin', 'staff')).toBe(true)
  })

  it('manager имеет доступ к staff', () => {
    expect(hasMinRole('manager', 'staff')).toBe(true)
  })
})
