import { computed } from 'vue'
import { useNuxtApp } from '#imports'
import type { Category } from '@fastio/shared'
import { categoriesApi, mapCategory } from '~/utils/api/categories'
import { useRealtimeList } from '~/composables/useRealtimeList'

export const useCategories = (tenantId: Ref<string>) => {
  const { $supabase } = useNuxtApp()

  const { items: categories, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `categories:${tenantId.value}` : null),
    table: 'categories',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => categoriesApi.list($supabase, tenantId.value),
    mapper: mapCategory,
  })

  const add = async (name: string, photo?: { photoUrl?: string | null; useFirstDishPhoto?: boolean }) => {
    if (!tenantId.value) return
    const cat = await categoriesApi.add($supabase, tenantId.value, { name, order: categories.value.length, ...photo })

    if (cat) categories.value.push(cat)
  }

  const update = async (id: string, data: Partial<Pick<Category, 'name' | 'active' | 'order' | 'photoUrl' | 'useFirstDishPhoto'>>) => {
    const cat = await categoriesApi.update($supabase, id, data)

    if (cat) {
      const i = categories.value.findIndex((c) => c.id === id)

      if (i !== -1) categories.value[i] = cat
    }
  }

  const remove = async (id: string) => {
    await categoriesApi.remove($supabase, id)
    categories.value = categories.value.filter((c) => c.id !== id)
  }

  const reorder = async (reordered: Category[]) => {
    categories.value = reordered
    await categoriesApi.reorder($supabase, reordered.map((c, i) => ({ id: c.id, order: i })))
  }

  return { categories, loading, add, update, remove, reorder }
}
