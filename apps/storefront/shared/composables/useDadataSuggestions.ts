import { useDadataSuggestions as useSharedDadataSuggestions } from '@fastio/shared'

export type { DadataSuggestion } from '@fastio/shared'

export const useDadataSuggestions = () => {
  return useSharedDadataSuggestions({ proxyUrl: '/api/dadata/suggest', debounce: 500 })
}
