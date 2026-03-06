import { ref, watch } from 'vue'
import { useSupabaseApi } from '~/composables/useSupabaseApi'

const useDishCounts = (tenantId: Ref<string>) => {
  const api = useSupabaseApi()
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
