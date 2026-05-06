import { computed, type Ref } from 'vue'
import type { Category, CategoryData, CategoryKind, CategoryType } from '@fastio/shared'
import { mapCategory } from '@fastio/shared'
import { useRealtimeList } from '~/composables/data/useRealtimeList'
import { useDatabase } from '~/composables/data/useDatabase'
import { reportError } from '~/utils/reportError'

export const useCategories = (tenantId: Ref<string>, kind: CategoryKind = 'food') => {
  const api = useDatabase()

  const { items: categories, loading, refresh } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `categories:${tenantId.value}:${kind}` : null),
    table: 'categories',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.categories.list(tenantId.value, kind),
    mapper: mapCategory,
    shouldInclude: (cat) => cat.kind === kind,
  })

  const add = async (name: string, extra?: { photoUrl?: string | null; useFirstDishPhoto?: boolean; color?: string | null; type?: CategoryType; tagId?: string | null }) => {
    if (!tenantId.value) return
    const cat = await api.categories.add(tenantId.value, { name, order: categories.value.length, kind, ...extra })

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
    const prev = categories.value

    categories.value = reordered
    try {
      await api.categories.reorder(reordered.map((c, i) => ({ id: c.id, order: i })))
    } catch (e) {
      categories.value = prev
      reportError(e)
      throw e
    }
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

  return { categories, loading, add, update, remove, reorder, updatePhoto, removePhoto, refresh }
}
