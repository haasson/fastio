import { ref, watch, onUnmounted } from 'vue'
import { useNuxtApp } from '#imports'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { dishesApi } from '~/utils/api/dishes'

const useDishCounts = (tenantId: Ref<string>) => {
  const { $supabase } = useNuxtApp()
  const counts = ref<Record<string, number>>({})
  let channel: RealtimeChannel | null = null

  const fetchCounts = async (tid: string) => {
    counts.value = await dishesApi.countsByCategory($supabase, tid)
  }

  watch(tenantId, (tid) => {
    channel?.unsubscribe()
    channel = null
    counts.value = {}
    if (!tid) return

    fetchCounts(tid)

    channel = $supabase
      .channel(`dish-counts:${tid}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dishes',
        filter: `tenant_id=eq.${tid}`,
      }, () => fetchCounts(tid))
      .subscribe()
  }, { immediate: true })

  onUnmounted(() => channel?.unsubscribe())

  return { counts }
}

export default useDishCounts
