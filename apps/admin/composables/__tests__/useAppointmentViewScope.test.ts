import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import type { RolePermissions } from '@fastio/shared'

// ──────────────────────────────────────────────────────────────────────────
// Stub tenantStore + storeToRefs до импорта тестируемого composable
// ──────────────────────────────────────────────────────────────────────────

const memberships = ref<Array<{ id: string; tenantId: string }>>([])
const currentTenantId = ref<string | null>(null)
const currentPermissions = ref<RolePermissions | null>(null)
const isOwner = ref(false)

vi.mock('~/stores/tenant', () => ({
  useTenantStore: () => ({
    memberships,
    currentTenantId,
    currentPermissions,
    isOwner,
  }),
}))

vi.mock('pinia', () => ({
  storeToRefs: <T extends object>(store: T) => store as Record<keyof T, unknown>,
}))

import { useAppointmentViewScope } from '../data/useAppointmentViewScope'

describe('useAppointmentViewScope', () => {
  beforeEach(() => {
    memberships.value = []
    currentTenantId.value = 'tenant-1'
    currentPermissions.value = null
    isOwner.value = false
  })

  describe('ownResourcesOnly — 4 комбинации view_all/view_own/owner', () => {
    it('owner всегда видит всех (даже если view_own=true, view_all=false)', () => {
      isOwner.value = true
      currentPermissions.value = {
        'appointments.view_own': true,
        'appointments.view_all': false,
      }
      const { ownResourcesOnly } = useAppointmentViewScope()

      expect(ownResourcesOnly.value).toBe(false)
    })

    it('view_all=true, view_own=true → видит всех (view_all побеждает)', () => {
      currentPermissions.value = {
        'appointments.view_all': true,
        'appointments.view_own': true,
      }
      const { ownResourcesOnly } = useAppointmentViewScope()

      expect(ownResourcesOnly.value).toBe(false)
    })

    it('view_own=true, view_all=false → видит только свои', () => {
      currentPermissions.value = {
        'appointments.view_own': true,
        'appointments.view_all': false,
      }
      const { ownResourcesOnly } = useAppointmentViewScope()

      expect(ownResourcesOnly.value).toBe(true)
    })

    it('оба флага false/undefined → видит всех (backwards compat для ролей без новых ключей)', () => {
      currentPermissions.value = { 'appointments.view': true }
      const { ownResourcesOnly } = useAppointmentViewScope()

      expect(ownResourcesOnly.value).toBe(false)
    })

    it('permissions === null → видит всех (роль без перезаписей)', () => {
      currentPermissions.value = null
      const { ownResourcesOnly } = useAppointmentViewScope()

      expect(ownResourcesOnly.value).toBe(false)
    })
  })

  describe('isOwnResource', () => {
    it('membership найден, ресурс с тем же memberId → true', () => {
      memberships.value = [{ id: 'mem-1', tenantId: 'tenant-1' }]
      const { isOwnResource } = useAppointmentViewScope()

      expect(isOwnResource({ memberId: 'mem-1' })).toBe(true)
    })

    it('ресурс без memberId (объект) → false', () => {
      memberships.value = [{ id: 'mem-1', tenantId: 'tenant-1' }]
      const { isOwnResource } = useAppointmentViewScope()

      expect(isOwnResource({ memberId: null })).toBe(false)
    })

    it('membership не найден в текущем тенанте → false', () => {
      memberships.value = [{ id: 'mem-1', tenantId: 'tenant-2' }]
      const { isOwnResource } = useAppointmentViewScope()

      expect(isOwnResource({ memberId: 'mem-1' })).toBe(false)
    })
  })

  describe('isOwnAppointment', () => {
    it('запись на чужом ресурсе → false', () => {
      memberships.value = [{ id: 'mem-1', tenantId: 'tenant-1' }]
      const { isOwnAppointment } = useAppointmentViewScope()
      const resources = [
        { id: 'res-1', memberId: 'mem-1' },
        { id: 'res-2', memberId: 'mem-2' },
      ]

      expect(isOwnAppointment({ resourceId: 'res-2' }, resources)).toBe(false)
    })

    it('запись на собственном ресурсе → true', () => {
      memberships.value = [{ id: 'mem-1', tenantId: 'tenant-1' }]
      const { isOwnAppointment } = useAppointmentViewScope()
      const resources = [{ id: 'res-1', memberId: 'mem-1' }]

      expect(isOwnAppointment({ resourceId: 'res-1' }, resources)).toBe(true)
    })

    it('запись без resourceId → false', () => {
      memberships.value = [{ id: 'mem-1', tenantId: 'tenant-1' }]
      const { isOwnAppointment } = useAppointmentViewScope()

      expect(isOwnAppointment({ resourceId: null }, [])).toBe(false)
    })
  })
})
