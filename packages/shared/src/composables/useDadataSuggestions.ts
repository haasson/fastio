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

export const useDadataSuggestions = (apiKey: string) => {
  const suggestions = ref<DadataSuggestion[]>([])
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3 || !apiKey) {
      suggestions.value = []

      return
    }

    loading.value = true
    try {
      const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${apiKey}`,
        },
        body: JSON.stringify({ query, count: 5 }),
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
