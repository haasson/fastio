import { ref, watch, type Ref, type WatchSource } from 'vue'

export const useQuery = <T>(
  fn: () => Promise<T>,
  deps: WatchSource[] = [],
) => {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<string | null>(null)

  const execute = async () => {
    loading.value = true
    error.value = null
    try { data.value = await fn() }
    catch (e: any) { error.value = e.message }
    finally { loading.value = false }
  }

  watch(deps, execute, { immediate: true, deep: true })

  return { data, loading, error, execute }
}
