import { ref, type Ref, watch } from 'vue'
import type { DishTagDefinition } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'

export function useTags(tenantId: Ref<string>) {
  const api = useDatabase()
  const tags = ref<DishTagDefinition[]>([])
  const loading = ref(false)

  const load = async () => {
    if (!tenantId.value) return
    loading.value = true
    tags.value = await api.tags.list(tenantId.value)
    loading.value = false
  }

  const add = async (data: { name: string; icon: string; color: string }) => {
    await api.tags.add(tenantId.value, data)
    await load()
  }

  const update = async (id: string, data: Partial<{ name: string; icon: string; color: string }>) => {
    await api.tags.update(id, data)
    await load()
  }

  const remove = async (id: string) => {
    await api.tags.remove(id)
    await load()
  }

  const reorder = async (reorderedTags: DishTagDefinition[]) => {
    tags.value = reorderedTags
    await api.tags.reorder(reorderedTags.map((t, i) => ({ id: t.id, order: i })))
  }

  watch(tenantId, (tid) => {
    if (tid) load()
  }, { immediate: true })

  return { tags, loading, load, add, update, remove, reorder }
}
