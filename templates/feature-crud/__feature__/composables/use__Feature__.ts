import { ref, watch, type Ref } from 'vue'
import { useDatabase } from '~/shared/data/useDatabase'
import { __FEATURE_CAMEL__Events } from './use__Feature__Channel'
import type { __FEATURE_PASCAL__, __FEATURE_PASCAL__FormData } from '../api/__feature__'

export const use__FEATURE_PASCAL__s = (tenantId: Ref<string>) => {
  const api = useDatabase()
  const items = ref<__FEATURE_PASCAL__[]>([])
  const loading = ref(false)

  const fetch = async () => {
    if (!tenantId.value) return
    loading.value = true
    try {
      // TODO: подключи api в useDatabase: api.__FEATURE_CAMEL__s.list(...)
      items.value = await api.__FEATURE_CAMEL__s.list(tenantId.value)
    } finally {
      loading.value = false
    }
  }

  watch(tenantId, fetch, { immediate: true })

  __FEATURE_CAMEL__Events.onInsert((entity) => {
    if (!items.value.find((x) => x.id === entity.id)) items.value.unshift(entity)
  })
  __FEATURE_CAMEL__Events.onUpdate((entity) => {
    const i = items.value.findIndex((x) => x.id === entity.id)
    if (i !== -1) items.value[i] = entity
  })
  __FEATURE_CAMEL__Events.onDelete(({ id }) => {
    items.value = items.value.filter((x) => x.id !== id)
  })

  const create = async (data: __FEATURE_PASCAL__FormData) => {
    if (!tenantId.value) return
    const res = await api.__FEATURE_CAMEL__s.create(tenantId.value, data)
    if (res) items.value.unshift(res)
  }

  const update = async (id: string, patch: Partial<__FEATURE_PASCAL__FormData>) => {
    const res = await api.__FEATURE_CAMEL__s.update(id, patch)
    if (res) {
      const i = items.value.findIndex((x) => x.id === id)
      if (i !== -1) items.value[i] = res
    }
    return res
  }

  const remove = async (id: string) => {
    await api.__FEATURE_CAMEL__s.remove(id)
    items.value = items.value.filter((x) => x.id !== id)
  }

  return { items, loading, refresh: fetch, create, update, remove }
}
