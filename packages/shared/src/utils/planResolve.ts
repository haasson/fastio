import type { Plan, ResolvedFeatures } from '../types/billing'
import { EMPTY_RESOLVED_FEATURES } from '../types/billing'
import type { BusinessType } from '../types/tenant'
import { getPlanTierOrder } from './planLevel'

/**
 * Аккумулирует фичи всех тарифов уровня ≤ выбранного для конкретного businessType.
 * Используется в онбординге (расчёт модулей при выборе тарифа) и в `useResolvedFeatures`.
 */
export const resolveFeaturesForPlan = (
  plans: readonly Plan[],
  planKey: string,
  businessType: BusinessType,
): ResolvedFeatures => {
  const order = getPlanTierOrder(planKey)
  const result: ResolvedFeatures = {
    modules: { ...EMPTY_RESOLVED_FEATURES.modules },
    menu: { ...EMPTY_RESOLVED_FEATURES.menu },
    resources: { ...EMPTY_RESOLVED_FEATURES.resources },
    site: { ...EMPTY_RESOLVED_FEATURES.site },
  }

  const eligible = plans.filter(
    (p) => p.businessType === businessType && getPlanTierOrder(p.key) <= order,
  )

  for (const p of eligible) {
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
}
