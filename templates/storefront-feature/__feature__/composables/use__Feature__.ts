import { ref } from 'vue'
import { __FEATURE_CAMEL__Api, type __FEATURE_PASCAL__ } from '../api/__feature__'

export const use__FEATURE_PASCAL__ = () => {
  const items = ref<__FEATURE_PASCAL__[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetch = async () => {
    loading.value = true
    error.value = null
    try {
      items.value = await __FEATURE_CAMEL__Api.list()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  return { items, loading, error, fetch }
}
