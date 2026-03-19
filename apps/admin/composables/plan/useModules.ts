import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import { usePlanFeatures } from './usePlanFeatures'
import { usePlans } from './usePlans'
import { useDatabase } from '~/composables/data/useDatabase'
import type { ModuleKey, ModuleConfig } from '~/config/modules'

type ModuleState = { active: boolean; locked: boolean; enabled: boolean }

const configs = ref<ModuleConfig[]>([])
const configsLoaded = ref(false)

export const useModuleConfigs = (): {
  configs: Ref<ModuleConfig[]>
  loaded: Ref<boolean>
  load: () => Promise<void>
} => {
  const api = useDatabase()

  const load = async () => {
    if (configsLoaded.value) return
    configs.value = await api.moduleConfigs.list()
    configsLoaded.value = true
  }

  return { configs, loaded: configsLoaded, load }
}

export const useModules = (): Record<ModuleKey, ComputedRef<ModuleState>> => {
  const tenantStore = useTenantStore()
  const { plan } = usePlanFeatures()
  const { getPlanSortOrder } = usePlans()
  const { configs: moduleConfigs } = useModuleConfigs()

  const entries = moduleConfigs.value.map(({ key, requiredPlan }) => [
    key,
    computed<ModuleState>(() => {
      const active = tenantStore.tenant?.modules?.[key] ?? false
      const locked = getPlanSortOrder(plan.value) < getPlanSortOrder(requiredPlan)

      return { active, locked, enabled: active && !locked }
    }),
  ])

  return Object.fromEntries(entries) as Record<ModuleKey, ComputedRef<ModuleState>>
}
