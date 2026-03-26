import { ref, watch, type Ref } from 'vue'
import type { Category } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

const useDishCounts = (tenantId: Ref<string>, categories?: Ref<Category[]>) => {
  const api = useDatabase()
  const counts = ref<Record<string, number>>({})

  const refresh = async () => {
    if (!tenantId.value) return
    const [dishCounts, comboCounts, tagCounts] = await Promise.all([
      api.dishes.countsByCategory(tenantId.value),
      api.combos.countsByCategory(tenantId.value),
      api.tags.countsByTag(tenantId.value),
    ])

    const result = { ...dishCounts, ...comboCounts }

    for (const cat of categories?.value ?? []) {
      if (cat.tagId) {
        result[cat.id] = tagCounts[cat.tagId] ?? 0
      }
    }

    counts.value = result
  }

  watch(tenantId, (tid) => {
    counts.value = {}
    if (tid) refresh()
  }, { immediate: true })

  return { counts, refresh }
}

export default useDishCounts
