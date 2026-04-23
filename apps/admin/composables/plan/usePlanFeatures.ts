import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'

export const usePlanFeatures = () => {
  const tenantStore = useTenantStore()

  const plan = computed(() => tenantStore.tenant?.subscription?.plan ?? 'showcase')

  return { plan }
}
