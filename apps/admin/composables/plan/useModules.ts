import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { useTenantStore } from '~/shared/stores/tenant'
import { useResolvedFeatures } from './useResolvedFeatures'
import { useDatabase } from '~/composables/data/useDatabase'
import type { ModuleKey, ModuleConfig } from '~/config/modules'

type ModuleState = {
  active: boolean
  locked: boolean
  absent: boolean
  enabled: boolean
}

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

const DEFAULT_STATE: ModuleState = { active: false, locked: true, absent: false, enabled: false }

export const useModules = (): Record<ModuleKey, ComputedRef<ModuleState>> => {
  const tenantStore = useTenantStore()
  const { resolved } = useResolvedFeatures()
  const { configs: moduleConfigs } = useModuleConfigs()

  // Лениво создаём computed для каждого ключа по запросу, чтобы работать до загрузки configs
  // и реагировать на их появление без пересоздания объекта.
  const cache = new Map<string, ComputedRef<ModuleState>>()

  const getState = (key: ModuleKey): ComputedRef<ModuleState> => {
    const existing = cache.get(key)

    if (existing) return existing

    const state = computed<ModuleState>(() => {
      const cfg = moduleConfigs.value.find((c) => c.key === key)

      if (!cfg) return DEFAULT_STATE

      const tenant = tenantStore.tenant
      const tenantBusinessType = tenant.businessType
      const tenantMenuStyle = tenant.menuStyle
      const wrongBusinessType = tenantBusinessType !== null && !cfg.businessTypes.includes(tenantBusinessType)
      const wrongMenuStyle = cfg.menuStyles !== null && !cfg.menuStyles.includes(tenantMenuStyle)
      const absent = wrongBusinessType || wrongMenuStyle
      const active = tenant.modules?.[key] ?? false
      const locked = !absent && !resolved.value.modules[key]

      return { active, locked, absent, enabled: active && !locked && !absent }
    })

    cache.set(key, state)

    return state
  }

  return new Proxy({} as Record<ModuleKey, ComputedRef<ModuleState>>, {
    get: (_, prop: string) => getState(prop as ModuleKey),
  })
}
