import { useDadataSuggestions as useSharedDadataSuggestions } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

export type { DadataSuggestion } from '@fastio/shared'

export const useDadataSuggestions = () => {
  const tenantStore = useTenantStore()

  return useSharedDadataSuggestions({
    proxyUrl: '/api/dadata/suggest',
    extraBody: () => ({ tenantId: tenantStore.tenant?.id }),
  })
}
