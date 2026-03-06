import { ref, watch, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useSupabaseApi } from '~/composables/useSupabaseApi'

const useDishCounts = (tenantId: Ref<string>) => {
  const api = useSupabaseApi()
  const counts = ref<Record<string, number>>({})
  let unsubscribe: (() => void) | null = null

  const fetchCounts = async (tid: string) => {
    counts.value = await api.dishes.countsByCategory(tid)
  }

  watch(tenantId, (tid) => {
    unsubscribe?.()
    unsubscribe = null
    counts.value = {}
    if (!tid) return

    fetchCounts(tid)

    const debouncedFetch = useDebounceFn(() => fetchCounts(tid), 300)

    unsubscribe = api.dishes.subscribeToDishChanges(tid, debouncedFetch)
  }, { immediate: true })

  onUnmounted(() => unsubscribe?.())

  return { counts }
}

export default useDishCounts
