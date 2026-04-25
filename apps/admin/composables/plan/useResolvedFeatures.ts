import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import { usePlanFeatures } from './usePlanFeatures'
import { usePlans } from './usePlans'
import type { ResolvedFeatures } from '@fastio/shared'
import { EMPTY_RESOLVED_FEATURES, getPlanTierOrder } from '@fastio/shared'

export const useResolvedFeatures = () => {
  const { plan } = usePlanFeatures()
  const { plans } = usePlans()
  const tenantStore = useTenantStore()

  const resolved = computed((): ResolvedFeatures => {
    const currentOrder = getPlanTierOrder(plan.value)
    const businessType = tenantStore.tenant.businessType ?? 'retail'

    const result: ResolvedFeatures = {
      modules: { ...EMPTY_RESOLVED_FEATURES.modules },
      menu: { ...EMPTY_RESOLVED_FEATURES.menu },
      resources: { ...EMPTY_RESOLVED_FEATURES.resources },
      site: { ...EMPTY_RESOLVED_FEATURES.site },
    }

    const eligiblePlans = plans.value.filter(
      (p) => p.businessType === businessType && getPlanTierOrder(p.key) <= currentOrder,
    )

    for (const p of eligiblePlans) {
      const f = p.features

      if (f.modules) {
        for (const [k, v] of Object.entries(f.modules)) {
          if (v === true) (result.modules as Record<string, boolean>)[k] = true
        }
      }
      if (f.menu?.virtualCategories) result.menu.virtualCategories = true
      if (f.menu?.ingredients) result.menu.ingredients = true
      if (f.resources?.max !== undefined) result.resources.max = f.resources.max
      if (f.site?.telegramNotifications) result.site.telegramNotifications = true
    }

    return result
  })

  return { resolved }
}
