import { shallowRef, type Ref } from 'vue'
import { ofetch } from 'ofetch'

// ============================================================================
// ApiError
// ============================================================================

const FALLBACK_ERROR_TEXT = 'Произошла непредвиденная ошибка. Попробуйте позже.'

export class ApiError extends Error {
  code: number | null
  text: string

  constructor(options: { code?: number | null; text?: string } = {}) {
    const text = options.text || FALLBACK_ERROR_TEXT
    super(text)
    this.name = 'ApiError'
    this.code = options.code ?? null
    this.text = text
  }
}

// ============================================================================
// Global error state
// Подключи в лейауте: const { error } = useGlobalApiError()
// и показывай тост когда error.value !== null
// ============================================================================

const globalError = shallowRef<ApiError | null>(null)

export function useGlobalApiError() {
  return {
    error: globalError,
    clear: () => { globalError.value = null },
  }
}

// ============================================================================
// Types
// ============================================================================

export type UseApiOptions = {
  cache?: boolean    // Кешировать результат в памяти
  parallel?: boolean // Не отменять предыдущий запрос при новом вызове
  showError?: boolean // Записывать ошибку в глобальный стейт (default: true)
}

export type UseApiUrl<P> = string | ((payload: P) => string)

export type UseApiReturn<T, P> = {
  data: Ref<T | null>
  error: Ref<ApiError | null>
  loading: Ref<boolean>
  execute: (payload?: P) => Promise<T | null>
}

// ============================================================================
// Cache
// ============================================================================

const apiCache = new Map<string, unknown>()

// ============================================================================
// useApi
// ============================================================================

export function useApi<T = unknown, P = Record<string, unknown>>(
  url: UseApiUrl<P>,
  options: UseApiOptions = {},
): UseApiReturn<T, P> {
  const { cache = false, parallel = false, showError = true } = options

  const data = shallowRef<T | null>(null) as Ref<T | null>
  const error = shallowRef<ApiError | null>(null) as Ref<ApiError | null>
  const loading = shallowRef(false)

  let abortController: AbortController | null = null

  const resolveUrl = (payload?: P): string =>
    typeof url === 'function' ? url(payload as P) : url

  const getCacheKey = (resolvedUrl: string, payload?: P): string =>
    `${resolvedUrl}:${payload ? JSON.stringify(payload) : ''}`

  const parseError = (err: unknown): ApiError => {
    const code = (err as any)?.statusCode ?? (err as any)?.response?.status ?? null
    const message =
      (err as any)?.data?.message
      ?? (err as any)?.response?._data?.message
      ?? (err instanceof Error ? err.message : String(err))

    return new ApiError({ code, text: message })
  }

  const execute = async (payload?: P): Promise<T | null> => {
    if (!parallel && abortController) {
      abortController.abort()
    }

    const controller = new AbortController()
    if (!parallel) abortController = controller

    loading.value = true
    error.value = null

    try {
      const resolvedUrl = resolveUrl(payload)
      const cacheKey = getCacheKey(resolvedUrl, payload)

      if (cache && apiCache.has(cacheKey)) {
        data.value = apiCache.get(cacheKey) as T
        return data.value
      }

      const result = await ofetch<T>(resolvedUrl, {
        method: 'POST',
        body: payload,
        signal: controller.signal,
      })

      data.value = result
      if (cache) apiCache.set(cacheKey, result)

      return result
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null

      const apiError = parseError(err)
      error.value = apiError
      if (showError) globalError.value = apiError

      return null
    } finally {
      if (abortController === controller) abortController = null
      loading.value = false
    }
  }

  return { data, error, loading, execute }
}
