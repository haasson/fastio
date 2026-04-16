import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { isLegalInfoComplete } from '@fastio/shared'

export default function useLegalCompliance() {
  const { data: tenant } = useNuxtData<Tenant>('tenant')
  const legalInfoComplete = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
  return { legalInfoComplete }
}
