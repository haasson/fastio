import { ref, onUnmounted, getCurrentInstance } from 'vue'

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

export function useDadataSuggestions() {
  const suggestions = ref<DadataSuggestion[]>([])
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  async function fetchSuggestions(query: string) {
    if (!query || query.length < 3) {
      suggestions.value = []
      return
    }

    loading.value = true
    try {
      const res = await $fetch<{ suggestions: DadataSuggestion[] }>('/api/dadata/suggest', {
        method: 'POST',
        body: { query },
      })
      suggestions.value = res.suggestions ?? []
    } catch {
      suggestions.value = []
    } finally {
      loading.value = false
    }
  }

  function search(query: string) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fetchSuggestions(query), 300)
  }

  const showSuggestions = ref(false)

  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function hideSuggestionsDelayed() {
    hideTimer = setTimeout(() => { showSuggestions.value = false }, 200)
  }

  function clear() {
    suggestions.value = []
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (timer) clearTimeout(timer)
      if (hideTimer) clearTimeout(hideTimer)
    })
  }

  return { suggestions, loading, search, clear, showSuggestions, hideSuggestionsDelayed }
}
