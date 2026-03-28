import { useRuntimeConfig } from '#imports'
import { useDadataSuggestions as useSharedDadataSuggestions } from '@fastio/shared'

export type { DadataSuggestion } from '@fastio/shared'

export const useDadataSuggestions = () => {
  const config = useRuntimeConfig()
  const proxyUrl = `${config.public.supabaseUrl}/functions/v1/dadata-suggest`

  return useSharedDadataSuggestions(proxyUrl)
}
