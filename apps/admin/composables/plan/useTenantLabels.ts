import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'

export const useTenantLabels = () => {
  const tenantStore = useTenantStore()

  const menuLabel = computed(() => {
    const type = tenantStore.tenant?.businessType

    if (type === 'food') return 'Меню'
    if (type === 'services') return 'Услуги'

    return 'Каталог'
  })

  return { menuLabel }
}
