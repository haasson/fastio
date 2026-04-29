import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Tenant, Category } from '@fastio/shared'
import { useMenuStore } from '~/stores/menu'
import { useServicesStore } from '~/stores/services'

/**
 * Определяет режим каталога (services vs menu) и отдаёт visibleCategories
 * из правильного стора. Используется CategoryBar и навигацией по категориям —
 * остальной рендер делают сами Section'ы (MenuSection / ServicesSection).
 */
export function useCatalogMode() {
  const { data: tenant } = useNuxtData<Tenant>('tenant')
  const menuStore = useMenuStore()
  const servicesStore = useServicesStore()

  const isServicesMode = computed(() =>
    tenant.value?.businessType === 'services' && tenant.value?.modules?.services === true,
  )

  const visibleCategories = computed<Category[]>(() =>
    isServicesMode.value ? servicesStore.visibleCategories : menuStore.visibleCategories,
  )

  return { isServicesMode, visibleCategories }
}
