import { ref, watch, type Ref } from 'vue'
import { useDatabase } from '~/composables/data/useDatabase'

const useDishCounts = (tenantId: Ref<string>) => {
  const api = useDatabase()
  const counts = ref<Record<string, number>>({})

  const refresh = async () => {
    if (!tenantId.value) return
    counts.value = await api.dishes.countsByCategory(tenantId.value)
  }

  watch(tenantId, (tid) => {
    counts.value = {}
    if (tid) refresh()
  }, { immediate: true })

  return { counts, refresh }
}

export default useDishCounts
