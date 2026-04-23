import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'

export const useTenantLabels = () => {
  const tenantStore = useTenantStore()

  const businessType = computed(() => tenantStore.tenant?.businessType)
  const menuStyle = computed(() => tenantStore.tenant?.menuStyle ?? 'food')
  const isServices = computed(() => businessType.value === 'services')
  const isRetail = computed(() => businessType.value === 'retail')

  const menuLabel = computed(() => {
    if (isServices.value) return 'Услуги'

    return menuStyle.value === 'catalog' ? 'Каталог' : 'Меню'
  })

  const itemLabel = computed(() => {
    if (isServices.value) return 'услуга'

    return menuStyle.value === 'catalog' ? 'товар' : 'блюдо'
  })

  const itemsLabel = computed(() => {
    if (isServices.value) return 'Услуги'

    return menuStyle.value === 'catalog' ? 'Товары' : 'Блюда'
  })

  const itemsLabelLower = computed(() => {
    if (isServices.value) return 'услуги'

    return menuStyle.value === 'catalog' ? 'товары' : 'блюда'
  })

  const itemsLabelGen = computed(() => {
    if (isServices.value) return 'услуг'

    return menuStyle.value === 'catalog' ? 'товаров' : 'блюд'
  })

  const reservationsLabel = computed(() => isServices.value ? 'Запись' : 'Бронирование')

  return { menuLabel, isServices, isRetail, menuStyle, itemLabel, itemsLabel, itemsLabelLower, itemsLabelGen, reservationsLabel }
}
