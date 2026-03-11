import { ref } from 'vue'

export const useMutation = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) => {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const execute = async (...args: TArgs): Promise<TResult | null> => {
    loading.value = true
    error.value = null
    try { return await fn(...args) }
    catch (e: any) { error.value = e.message; return null }
    finally { loading.value = false }
  }

  return { execute, loading, error }
}
