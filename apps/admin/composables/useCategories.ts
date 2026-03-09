import { computed, type Ref } from 'vue'
import type { Category, CategoryData } from '@fastio/shared'
import { mapCategory } from '~/utils/api/categories'
import { useRealtimeList } from '~/composables/useRealtimeList'
import { useDatabase } from '~/composables/useDatabase'

export const useCategories = (tenantId: Ref<string>) => {
  const api = useDatabase()

  const { items: categories, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `categories:${tenantId.value}` : null),
    table: 'categories',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.categories.list(tenantId.value),
    mapper: mapCategory,
  })

  const add = async (name: string, extra?: { photoUrl?: string | null; useFirstDishPhoto?: boolean; color?: string | null }) => {
    if (!tenantId.value) return
    const cat = await api.categories.add(tenantId.value, { name, order: categories.value.length, ...extra })

    if (cat) categories.value.push(cat)
  }

  const update = async (id: string, data: CategoryData) => {
    const cat = await api.categories.update(id, data)

    if (cat) {
      const i = categories.value.findIndex((c) => c.id === id)

      if (i !== -1) categories.value[i] = cat
    }
  }

  const remove = async (id: string) => {
    await api.categories.remove(id)
    categories.value = categories.value.filter((c) => c.id !== id)
  }

  const reorder = async (reordered: Category[]) => {
    categories.value = reordered
    await api.categories.reorder(reordered.map((c, i) => ({ id: c.id, order: i })))
  }

  const updatePhoto = async (id: string, file: File) => {
    const cat = categories.value.find((c) => c.id === id)

    if (cat?.photoUrl) await api.categories.deletePhoto(cat.photoUrl)

    const url = await api.categories.uploadPhoto(tenantId.value, file)

    await update(id, { photoUrl: url })
  }

  const removePhoto = async (id: string) => {
    const cat = categories.value.find((c) => c.id === id)

    if (cat?.photoUrl) await api.categories.deletePhoto(cat.photoUrl)

    await update(id, { photoUrl: null })
  }

  return { categories, loading, add, update, remove, reorder, updatePhoto, removePhoto }
}
