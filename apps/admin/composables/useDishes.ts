import { ref, watch, onUnmounted } from 'vue'
import { useNuxtApp } from '#imports'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Dish } from '@fastio/shared'
import { dishesApi, type DishFormData } from '~/utils/api/dishes'

export function useDishes(tenantId: Ref<string>, categoryId: Ref<string | null>) {
  const { $supabase } = useNuxtApp()
  const dishes = ref<Dish[]>([])
  const loading = ref(false)

  let channel: RealtimeChannel | null = null

  const fetchDishes = async (tid: string, cid: string) => {
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

  const add = async (data: DishFormData) => {
    const tid = tenantId.value

    if (!tid) return
    await dishesApi.add($supabase, tid, { ...data, order: dishes.value.length })
  }

  const update = async (id: string, data: Partial<DishFormData>) => {
    await dishesApi.update($supabase, id, data)
  }

  const remove = async (id: string) => {
    await dishesApi.remove($supabase, id)
  }

  const toggleActive = async (id: string, active: boolean) => {
    await dishesApi.toggleActive($supabase, id, active)
  }

  return { dishes, loading, add, update, remove, toggleActive }
}
