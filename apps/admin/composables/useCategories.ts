import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Category } from '@fastio/shared'

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    order: row.sort_order as number,
    active: row.active as boolean,
  }
}

export function useCategories(tenantId: Ref<string>) {
  const { $supabase } = useNuxtApp()
  const categories = ref<Category[]>([])
  const loading = ref(true)

  let channel: RealtimeChannel | null = null

  async function fetchCategories(id: string) {
    loading.value = true
    const { data } = await $supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', id)
      .order('sort_order')

    categories.value = (data ?? []).map(mapCategory)
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
    const sortOrder = categories.value.length
    await $supabase.from('categories').insert({
      tenant_id: id,
      name,
      sort_order: sortOrder,
      active: true,
    })
  }

  async function update(id: string, data: Partial<Pick<Category, 'name' | 'active' | 'order'>>) {
    await $supabase.from('categories').update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.active !== undefined && { active: data.active }),
      ...(data.order !== undefined && { sort_order: data.order }),
    }).eq('id', id)
  }

  async function remove(id: string) {
    await $supabase.from('categories').delete().eq('id', id)
  }

  return { categories, loading, add, update, remove }
}
