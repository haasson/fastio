import { ref, getCurrentInstance, onUnmounted } from 'vue'

export type DadataSuggestion = {
  value: string
  data: {
    geo_lat: string | null
    geo_lon: string | null
    city: string | null
    street: string | null
    house: string | null
  }
}

export type DadataSuggestionsOptions = {
  proxyUrl: string
  debounce?: number
}

export const useDadataSuggestions = (options: DadataSuggestionsOptions | string) => {
  const { proxyUrl, debounce = 300 } = typeof options === 'string'
    ? { proxyUrl: options }
    : options

  const suggestions = ref<DadataSuggestion[]>([])
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3 || !proxyUrl) {
      suggestions.value = []
      return
    }

    loading.value = true
    try {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      const json = await res.json()
      suggestions.value = json.suggestions ?? []
    } catch {
      suggestions.value = []
    } finally {
      loading.value = false
    }
  }

  const search = (query: string) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fetchSuggestions(query), debounce)
  }

  const showSuggestions = ref(false)

  const hideSuggestionsDelayed = () => {
    hideTimer = setTimeout(() => { showSuggestions.value = false }, 200)
  }

  const clear = () => {
    suggestions.value = []
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (timer) clearTimeout(timer)
      if (hideTimer) clearTimeout(hideTimer)
    })
  }

  return { suggestions, loading, search, fetchSuggestions, clear, showSuggestions, hideSuggestionsDelayed }
}
