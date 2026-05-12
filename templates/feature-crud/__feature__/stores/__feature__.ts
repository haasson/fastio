import { defineStore } from 'pinia'
import { computed } from 'vue'
import { use__FEATURE_PASCAL__s } from '../composables/use__Feature__'
import { useTenantStore } from '~/shared/stores/tenant'

export const use__FEATURE_PASCAL__sStore = defineStore('__FEATURE_CAMEL__s', () => {
  const tenantStore = useTenantStore()
  const tenantId = computed(() => tenantStore.currentTenantId ?? '')
  return use__FEATURE_PASCAL__s(tenantId)
})
