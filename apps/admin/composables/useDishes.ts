import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Dish } from '@fastio/shared'

export function useDishes(tenantId: Ref<string>, categoryId: Ref<string | null>) {
  const { $supabase } = useNuxtApp()
  const dishes = ref<Dish[]>([])
  const loading = ref(false)

  let channel: RealtimeChannel | null = null

  async function fetchDishes(tid: string, cid: string) {
    loading.value = true
    dishes.value = await dishesApi.list($supabase, tid, cid)
    loading.value = false
  }

  watch(
    [tenantId, categoryId],
    ([tid, cid]) => {
      channel?.unsubscribe()
      channel = null
      dishes.value = []

      if (!tid || !cid) return

      fetchDishes(tid, cid)

      channel = $supabase
        .channel(`dishes:${tid}:${cid}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'dishes',
          filter: `tenant_id=eq.${tid}`,
        }, () => fetchDishes(tid, cid))
        .subscribe()
    },
    { immediate: true },
  )

  onUnmounted(() => channel?.unsubscribe())

  async function add(data: DishFormData) {
    const tid = tenantId.value
    if (!tid) return
    await dishesApi.add($supabase, tid, { ...data, order: dishes.value.length })
  }

  async function update(id: string, data: Partial<DishFormData>) {
    await dishesApi.update($supabase, id, data)
  }

  async function remove(id: string) {
    await dishesApi.remove($supabase, id)
  }

  async function toggleActive(id: string, active: boolean) {
    await dishesApi.toggleActive($supabase, id, active)
  }

  return { dishes, loading, add, update, remove, toggleActive }
}

export function useDishCounts(tenantId: Ref<string>) {
  const { $supabase } = useNuxtApp()
  const counts = ref<Record<string, number>>({})
  let channel: RealtimeChannel | null = null

  async function fetchCounts(tid: string) {
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
