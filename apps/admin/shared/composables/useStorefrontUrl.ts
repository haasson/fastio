import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTenantStore } from '~/shared/stores/tenant'

export const useStorefrontUrl = () => {
  const { tenant } = storeToRefs(useTenantStore())

  const baseUrl = computed(() => {
    const t = tenant.value

    return t.customDomain ? `https://${t.customDomain}` : `https://${t.slug}.fastio.ru`
  })

  return { baseUrl }
}
