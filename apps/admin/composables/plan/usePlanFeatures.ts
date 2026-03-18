import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'

type Plan = 'start' | 'business' | 'pro'

export const usePlanFeatures = () => {
  const tenantStore = useTenantStore()

  const plan = computed<Plan>(() => {
    const p = tenantStore.tenant?.subscription?.plan

    return (p && ['start', 'business', 'pro'].includes(p) ? p : 'start') as Plan
  })

  return { plan }
}
