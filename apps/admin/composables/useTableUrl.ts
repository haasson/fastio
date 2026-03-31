import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import { storeToRefs } from 'pinia'

export const useTableUrl = () => {
  const tenantStore = useTenantStore()
  const { tenant } = storeToRefs(tenantStore)

  const baseUrl = computed(() => {
    if (!tenant.value) return ''

    if (tenant.value.customDomain) {
      return `https://${tenant.value.customDomain}`
    }

    return `https://${tenant.value.slug}.fastio.ru`
  })

  const getTableUrl = (tableId: string) => `${baseUrl.value}/table/${tableId}`

  return { baseUrl, getTableUrl }
}
