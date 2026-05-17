import { useDadataSuggestions as useSharedDadataSuggestions } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'

export type { DadataSuggestion } from '@fastio/shared'

export const useDadataSuggestions = (config?: { cityOnly?: boolean }) => {
  const tenantStore = useTenantStore()

  return useSharedDadataSuggestions({
    proxyUrl: '/api/dadata/suggest',
    extraBody: () => ({
      tenantId: tenantStore.tenant.id,
      ...(config?.cityOnly ? { level: 'city' } : {}),
    }),
  })
}
