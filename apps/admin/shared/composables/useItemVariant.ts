import { computed } from 'vue'
import { selectItemVariant } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'

/** Тип витрины (food / catalog / services) для текущего тенанта. Используется для иконок-плейсхолдеров. */
export const useItemVariant = () => {
  const tenantStore = useTenantStore()

  const variant = computed(() => selectItemVariant(tenantStore.tenant.businessType, tenantStore.tenant.menuStyle))

  return { variant }
}
