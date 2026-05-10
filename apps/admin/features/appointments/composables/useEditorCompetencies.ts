import { ref } from 'vue'
import type { Resource, Service } from '@fastio/shared'
import { getEffectiveServiceIds } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

type CompetenciesBundle = {
  serviceResources: Awaited<ReturnType<ReturnType<typeof useDatabase>['resources']['bulkLoadCompetencies']>>['serviceResources']
  resourceCategories: Awaited<ReturnType<ReturnType<typeof useDatabase>['resources']['bulkLoadCompetencies']>>['resourceCategories']
}

// Module-level кэш ответов `bulkLoadCompetencies` на сессию по совокупности
// resource_ids. Без него каждый realtime-эвент таймлайна (200мс debounce) и
// каждое открытие редактора визита делали RPC, хотя competencies меняются
// редко (через настройки услуг/категорий). Аналог `servicesCache` в timeline.vue.
//
// Key = отсортированный resource_ids.join(','). UUID гарантирует уникальность
// кросс-тенантов, отдельный tenantId в ключе не нужен. Если состав ресурсов
// меняется (новый сотрудник) — ключ другой → автоматически новый запрос.
//
// Trade-off: если админ изменил привязки услуг к ресурсу в той же сессии,
// кэш отдаст устаревшие данные. Допустимо — редактор обычно открывается на
// короткое время; для строгой свежести есть `competenciesCache.clear()`.
const competenciesCache = new Map<string, Promise<CompetenciesBundle>>()

const cacheKey = (resourceIds: string[]): string => [...resourceIds].sort().join(',')

export const clearCompetenciesCache = (): void => {
  competenciesCache.clear()
}

/**
 * Загружает компетенции (явные через `service_resources` + категории через
 * `resource_categories`) и собирает Map<resourceId, Set<serviceId>>.
 *
 * Используется в `VisitContent` чтобы фильтровать селект мастера по принципу
 * «ресурс умеет эту услугу».
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
      const key = cacheKey(resourceIds)
      let promise = competenciesCache.get(key)

      if (!promise) {
        promise = api.resources.bulkLoadCompetencies(resourceIds).catch((e) => {
          competenciesCache.delete(key)
          throw e
        })
        competenciesCache.set(key, promise)
      }

      const { serviceResources, resourceCategories } = await promise

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
