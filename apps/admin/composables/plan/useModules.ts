import { computed, type ComputedRef } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import { usePlanFeatures } from './usePlanFeatures'
import { MODULE_CONFIGS, PLAN_ORDER, type ModuleKey } from '~/config/modules'

export { PLAN_LABELS } from '~/config/modules'

type ModuleState = { active: boolean; locked: boolean; enabled: boolean }

export const useModules = () => {
  const tenantStore = useTenantStore()
  const { plan } = usePlanFeatures()

  const entries = MODULE_CONFIGS.map(({ key, requiredPlan }) => [
    key,
    computed<ModuleState>(() => {
      const active = tenantStore.tenant?.modules?.[key] ?? false
      const locked = PLAN_ORDER[plan.value] < PLAN_ORDER[requiredPlan]

      return { active, locked, enabled: active && !locked }
    }),
  ])

  return Object.fromEntries(entries) as Record<ModuleKey, ComputedRef<ModuleState>>
}
