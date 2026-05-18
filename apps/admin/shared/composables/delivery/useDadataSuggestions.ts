import { useDadataSuggestions as useSharedDadataSuggestions } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'

export type { DadataSuggestion } from '@fastio/shared'

export const useDadataSuggestions = (config?: { cityOnly?: boolean }) => {
  const tenantStore = useTenantStore()
  const { auth } = useDatabase()

  return useSharedDadataSuggestions({
    proxyUrl: '/api/dadata/suggest',
    extraBody: () => ({
      tenantId: tenantStore.tenant.id,
      ...(config?.cityOnly ? { level: 'city' } : {}),
    }),
    // Admin /api/dadata/suggest требует JWT (requireMemberOfTenant) — токен
    // тянем из текущей Supabase-сессии. Если пользователь разлогинился между
    // вводом символов, getAccessToken() вернёт null → серверу прилетит без
    // Authorization → 401, что корректно (suggestions просто исчезнут).
    headers: async () => {
      const token = await auth.getAccessToken()

      return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)
    },
  })
}
