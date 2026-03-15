import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'

// Единый конфиг фич по тарифу.
// Чтобы открыть/закрыть фичу — меняй ТОЛЬКО здесь.
const PLAN_FEATURES = {
  start: {
    delivery: false,
    promotions: false,
    combos: false,
    multipleBranches: false,
    branchSettings: false,
    customDomain: false,
  },
  business: {
    delivery: true,
    promotions: true,
    combos: true,
    multipleBranches: false,
    branchSettings: true,
    customDomain: false,
  },
  pro: {
    delivery: true,
    promotions: true,
    combos: true,
    multipleBranches: true,
    branchSettings: true,
    customDomain: true,
  },
} as const

type Plan = keyof typeof PLAN_FEATURES

export const usePlanFeatures = () => {
  const tenantStore = useTenantStore()

  const plan = computed<Plan>(() => {
    const p = tenantStore.tenant?.subscription?.plan

    return (p && p in PLAN_FEATURES ? p : 'start') as Plan
  })

  const features = computed(() => PLAN_FEATURES[plan.value])

  return {
    plan,
    canUseDelivery: computed(() => features.value.delivery),
    canUsePromotions: computed(() => features.value.promotions),
    canUseCombos: computed(() => features.value.combos),
    canUseMultipleBranches: computed(() => features.value.multipleBranches),
    canUseBranchSettings: computed(() => features.value.branchSettings),
    canUseCustomDomain: computed(() => features.value.customDomain),
  }
}
