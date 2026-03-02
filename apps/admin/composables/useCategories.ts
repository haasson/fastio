import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Category } from '@fastio/shared'

export function useCategories(tenantId: Ref<string>) {
  const { $supabase } = useNuxtApp()
  const categories = ref<Category[]>([])
  const loading = ref(true)

  let channel: RealtimeChannel | null = null

  async function fetchCategories(id: string) {
    loading.value = true
    categories.value = await categoriesApi.list($supabase, id)
    loading.value = false
  }

  watch(
    tenantId,
    (id) => {
      channel?.unsubscribe()
      channel = null

      if (!id) return

      fetchCategories(id)

      channel = $supabase
        .channel(`categories:${id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `tenant_id=eq.${id}`,
        }, () => fetchCategories(id))
        .subscribe()
    },
    { immediate: true },
  )

  onUnmounted(() => channel?.unsubscribe())

  async function add(name: string) {
    const id = tenantId.value
    if (!id) return
    await categoriesApi.add($supabase, id, { name, order: categories.value.length })
  }

  async function update(id: string, data: Partial<Pick<Category, 'name' | 'active' | 'order'>>) {
    await categoriesApi.update($supabase, id, data)
  }

  async function remove(id: string) {
    await categoriesApi.remove($supabase, id)
  }

  return { categories, loading, add, update, remove }
}
