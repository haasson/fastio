import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Dish } from '@fastio/shared'

export type DishFormData = Omit<Dish, 'id' | 'tenantId' | 'photos'>

function mapDish(row: Record<string, unknown>): Dish {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    categoryId: row.category_id as string,
    name: row.name as string,
    description: row.description as string,
    price: row.price as number,
    photos: row.photos as string[],
    ingredients: row.ingredients as Dish['ingredients'],
    nutrition: row.nutrition as Dish['nutrition'],
    tags: row.tags as Dish['tags'],
    active: row.active as boolean,
    order: row.sort_order as number,
  }
}

export function useDishes(tenantId: Ref<string>, categoryId: Ref<string | null>) {
  const { $supabase } = useNuxtApp()
  const dishes = ref<Dish[]>([])
  const loading = ref(false)

  let channel: RealtimeChannel | null = null

  async function fetchDishes(tid: string, cid: string) {
    loading.value = true
    const { data } = await $supabase
      .from('dishes')
      .select('*')
      .eq('tenant_id', tid)
      .eq('category_id', cid)
      .order('sort_order')

    dishes.value = (data ?? []).map(mapDish)
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
    await $supabase.from('dishes').insert({
      tenant_id: tid,
      category_id: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price,
      photos: [],
      ingredients: data.ingredients,
      nutrition: data.nutrition,
      tags: data.tags,
      active: data.active,
      sort_order: dishes.value.length,
    })
  }

  async function update(id: string, data: Partial<DishFormData>) {
    await $supabase.from('dishes').update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.categoryId !== undefined && { category_id: data.categoryId }),
      ...(data.ingredients !== undefined && { ingredients: data.ingredients }),
      ...(data.nutrition !== undefined && { nutrition: data.nutrition }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.active !== undefined && { active: data.active }),
      ...(data.order !== undefined && { sort_order: data.order }),
    }).eq('id', id)
  }

  async function remove(id: string) {
    await $supabase.from('dishes').delete().eq('id', id)
  }

  async function toggleActive(id: string, active: boolean) {
    await $supabase.from('dishes').update({ active }).eq('id', id)
  }

  return { dishes, loading, add, update, remove, toggleActive }
}

export function useDishCounts(tenantId: Ref<string>) {
  const { $supabase } = useNuxtApp()
  const counts = ref<Record<string, number>>({})
  let channel: RealtimeChannel | null = null

  async function fetchCounts(tid: string) {
    const { data } = await $supabase
      .from('dishes')
      .select('category_id')
      .eq('tenant_id', tid)

    const c: Record<string, number> = {}
    ;(data ?? []).forEach((row) => {
      const cid = row.category_id as string
      c[cid] = (c[cid] ?? 0) + 1
    })
    counts.value = c
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
