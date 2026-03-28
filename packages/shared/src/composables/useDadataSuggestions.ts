import { ref } from 'vue'

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

export const useDadataSuggestions = (proxyUrl: string) => {
  const suggestions = ref<DadataSuggestion[]>([])
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

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
    timer = setTimeout(() => fetchSuggestions(query), 300)
  }

  const showSuggestions = ref(false)

  const hideSuggestionsDelayed = () => {
    setTimeout(() => { showSuggestions.value = false }, 200)
  }

  const clear = () => {
    suggestions.value = []
  }

  return { suggestions, loading, search, clear, showSuggestions, hideSuggestionsDelayed }
}
