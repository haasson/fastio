import { ref, watch, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useNuxtApp } from '#imports'
import { dishesApi } from '~/utils/api/dishes'

const useDishCounts = (tenantId: Ref<string>) => {
  const { $supabase } = useNuxtApp()
  const counts = ref<Record<string, number>>({})
  let unsubscribe: (() => void) | null = null

  const fetchCounts = async (tid: string) => {
    counts.value = await dishesApi.countsByCategory($supabase, tid)
  }

  watch(tenantId, (tid) => {
    unsubscribe?.()
    unsubscribe = null
    counts.value = {}
    if (!tid) return

    fetchCounts(tid)

    const debouncedFetch = useDebounceFn(() => fetchCounts(tid), 300)

    unsubscribe = dishesApi.subscribeToDishChanges($supabase, tid, debouncedFetch)
  }, { immediate: true })

  onUnmounted(() => unsubscribe?.())

  return { counts }
}

export default useDishCounts
