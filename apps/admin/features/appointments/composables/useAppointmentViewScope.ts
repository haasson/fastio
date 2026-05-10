import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { Appointment, Resource } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'

/**
 * Видимость записей по роли. Owner и `appointments.view_all` видят всех.
 * `appointments.view_own` (без view_all) — только записи на ресурсах,
 * привязанных к собственному membership.
 *
 * Это **клиентский** фильтр. Серверный enforcement через RLS не реализован
 * — см. TECHDEBT.md «view_own RLS». Без него прямой supabase.from() с фронта
 * вернёт всё.
 */
export function useAppointmentViewScope() {
  const tenantStore = useTenantStore()
  const { memberships, currentTenantId, currentPermissions, isOwner } = storeToRefs(tenantStore)

  const currentMembershipId = computed(() => {
    const tid = currentTenantId.value

    if (!tid) return null

    return memberships.value.find((m) => m.tenantId === tid)?.id ?? null
  })

  const ownResourcesOnly = computed(() => {
    if (isOwner.value) return false
    const perms = currentPermissions.value

    if (!perms) return false

    return perms['appointments.view_own'] === true && perms['appointments.view_all'] !== true
  })

  const isOwnResource = (r: Pick<Resource, 'memberId'>): boolean => {
    const mid = currentMembershipId.value

    return mid !== null && r.memberId === mid
  }

  const isOwnAppointment = (a: Pick<Appointment, 'resourceId'>, resources: Pick<Resource, 'id' | 'memberId'>[]): boolean => {
    if (!a.resourceId) return false
    const mid = currentMembershipId.value

    if (mid === null) return false
    const r = resources.find((x) => x.id === a.resourceId)

    return r?.memberId === mid
  }

  return {
    ownResourcesOnly,
    currentMembershipId,
    isOwnResource,
    isOwnAppointment,
  }
}
