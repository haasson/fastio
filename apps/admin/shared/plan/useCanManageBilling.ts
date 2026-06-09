import { computed, type ComputedRef } from 'vue'
import { useTenantStore } from '~/shared/stores/tenant'

/**
 * Может ли текущий юзер управлять биллингом: владелец ИЛИ роль с `billing.manage`.
 *
 * Намеренно БЕЗ suspended-гейта (в отличие от `gate.manageBilling`): биллинг —
 * escape-hatch заблокированного тенанта, его нельзя глушить по suspended.
 * Используется в account-вкладках, gate.global (закрытие прямого URL) и
 * на странице /suspended (показывать ли CTA оплаты).
 */
export const useCanManageBilling = (): ComputedRef<boolean> => {
  const tenantStore = useTenantStore()

  return computed(() => tenantStore.isOwner || tenantStore.currentPermissions?.['billing.manage'] === true)
}
