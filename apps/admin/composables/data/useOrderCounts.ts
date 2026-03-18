import { ref, watch, type Ref } from 'vue'
import { useDatabase } from '~/composables/data/useDatabase'

type UseOrderCountsOptions = {
  excludeDeliveryTypes?: string[]
}

export const useOrderCounts = (tenantId: Ref<string>, branchId: Ref<string | null>, options: UseOrderCountsOptions = {}) => {
  const api = useDatabase()
  const counts = ref<Record<string, number>>({})

  const fetchCounts = async () => {
    if (!tenantId.value) return
    counts.value = await api.orders.counts(tenantId.value, branchId.value, options.excludeDeliveryTypes)
  }

  watch([tenantId, branchId], fetchCounts, { immediate: true })

  return { counts, fetchCounts }
}
