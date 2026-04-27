import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { selectVocabulary } from '@fastio/shared'
import type { Tenant } from '@fastio/shared'

export const useStorefrontTerms = () => {
  const { data: tenant } = useNuxtData<Tenant>('tenant')

  const entry = computed(() => selectVocabulary(
    tenant.value?.businessType ?? null,
    tenant.value?.menuStyle ?? 'food',
  ))

  const menu = computed(() => entry.value.menu)
  const item = computed(() => entry.value.item)

  return { menu, item }
}
