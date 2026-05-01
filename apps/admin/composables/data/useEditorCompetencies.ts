import { ref } from 'vue'
import type { Resource, Service } from '@fastio/shared'
import { getEffectiveServiceIds } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

/**
 * Загружает компетенции (явные через `service_resources` + категории через
 * `resource_categories`) и собирает Map<resourceId, Set<serviceId>>.
 *
 * Используется в `AppointmentGroupContent` / `AppointmentRequestContent` чтобы
 * фильтровать селект мастера по принципу «ресурс умеет эту услугу».
 */
export function useEditorCompetencies() {
  const api = useDatabase()
  const competencyByResource = ref<Map<string, Set<string>>>(new Map())
  const loading = ref(false)

  const load = async (resources: Resource[], services: Pick<Service, 'id' | 'categoryId'>[]): Promise<void> => {
    if (resources.length === 0) {
      competencyByResource.value = new Map()

      return
    }

    loading.value = true
    try {
      const resourceIds = resources.map((r) => r.id)
      const { serviceResources, resourceCategories } = await api.resources.bulkLoadCompetencies(resourceIds)

      const explicitByResource = new Map<string, string[]>()

      for (const row of serviceResources) {
        const arr = explicitByResource.get(row.resource_id) ?? []

        arr.push(row.service_id)
        explicitByResource.set(row.resource_id, arr)
      }

      const categoryIdsByResource = new Map<string, string[]>()

      for (const row of resourceCategories) {
        const arr = categoryIdsByResource.get(row.resource_id) ?? []

        arr.push(row.category_id)
        categoryIdsByResource.set(row.resource_id, arr)
      }

      const next = new Map<string, Set<string>>()

      for (const r of resources) {
        const ids = getEffectiveServiceIds(
          explicitByResource.get(r.id) ?? [],
          categoryIdsByResource.get(r.id) ?? [],
          services.map((s) => ({ id: s.id, categoryId: s.categoryId })),
        )

        next.set(r.id, new Set(ids))
      }

      competencyByResource.value = next
    } finally {
      loading.value = false
    }
  }

  return { competencyByResource, loading, load }
}
