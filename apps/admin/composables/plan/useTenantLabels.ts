import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'

export const useTenantLabels = () => {
  const tenantStore = useTenantStore()

  const businessType = computed(() => tenantStore.tenant?.businessType)
  const isServices = computed(() => businessType.value === 'services')

  const menuLabel = computed(() => {
    if (businessType.value === 'food') return 'Меню'
    if (businessType.value === 'services') return 'Услуги'

    return 'Каталог'
  })

  const itemLabel = computed(() => isServices.value ? 'услуга' : 'блюдо')
  const itemsLabel = computed(() => isServices.value ? 'Услуги' : 'Блюда')
  const itemsLabelLower = computed(() => isServices.value ? 'услуги' : 'блюда')
  const itemsLabelGen = computed(() => isServices.value ? 'услуг' : 'блюд')

  return { menuLabel, isServices, itemLabel, itemsLabel, itemsLabelLower, itemsLabelGen }
}
