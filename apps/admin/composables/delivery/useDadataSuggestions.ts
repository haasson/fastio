import { useRuntimeConfig } from '#imports'
import { useDadataSuggestions as useSharedDadataSuggestions } from '@fastio/shared'

export type { DadataSuggestion } from '@fastio/shared'

export const useDadataSuggestions = () => useSharedDadataSuggestions(useRuntimeConfig().public.dadataApiKey as string)
