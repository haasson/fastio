import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'

export function useCurrency() {
  const { data: tenant } = useNuxtData<Tenant>('tenant')
  return computed(() => tenant.value?.currency ?? '₽')
}
