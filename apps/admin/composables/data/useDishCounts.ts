import { ref, watch, type Ref } from 'vue'
import type { Category } from '@fastio/shared'
import { VIRTUAL_CATEGORY_TYPES } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

const useDishCounts = (tenantId: Ref<string>, categories?: Ref<Category[]>) => {
  const api = useDatabase()
  const counts = ref<Record<string, number>>({})

  const refresh = async () => {
    if (!tenantId.value) return
    const [dishCounts, comboCounts, tagCounts] = await Promise.all([
      api.dishes.countsByCategory(tenantId.value),
      api.combos.countsByCategory(tenantId.value),
      api.dishes.countsByTag(tenantId.value),
    ])

    const result = { ...dishCounts, ...comboCounts }

    for (const cat of categories?.value ?? []) {
      if (VIRTUAL_CATEGORY_TYPES.includes(cat.type as 'new' | 'hit')) {
        result[cat.id] = tagCounts[cat.type] ?? 0
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
