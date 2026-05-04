import { ref, getCurrentInstance, onUnmounted } from 'vue'

/**
 * Поля DaData, которые мы реально используем в коде. DaData отдаёт ~80 полей —
 * мы храним весь объект `data` целиком (jsonb), но типизируем только то, что
 * читаем сами. Любые дополнительные поля доступны через приведение типа.
 *
 * Канонический справочник всех полей: https://dadata.ru/api/suggest/address/
 */
export type DadataAddressData = {
  // Геокоординаты
  geo_lat: string | null
  geo_lon: string | null
  qc_geo: string | null

  // Иерархия (в виде «с типом» — для отображения)
  region_with_type: string | null
  area_with_type: string | null
  city_with_type: string | null
  settlement_with_type: string | null
  street_with_type: string | null

  // Дом/корпус/квартира — отдельно тип и значение
  house_type: string | null
  house: string | null
  block_type: string | null
  block: string | null
  flat_type: string | null
  flat: string | null
  postal_code: string | null

  // FIAS — для будущих фильтров «филиалы в Москве»
  fias_id: string | null
  city_fias_id: string | null

  // Уровень уверенности в адресе (0/1/2/3)
  qc: string | null

  // legacy/старые поля, которые ещё могут читать клиенты до пересборки
  city: string | null
  street: string | null
}

export type DadataSuggestion = {
  value: string
  unrestricted_value?: string
  data: DadataAddressData & Record<string, unknown>
}

export type DadataSuggestionsOptions = {
  proxyUrl: string
  debounce?: number
  extraBody?: Record<string, unknown> | (() => Record<string, unknown>)
}

export const useDadataSuggestions = (options: DadataSuggestionsOptions | string) => {
  const { proxyUrl, debounce = 300, extraBody } = typeof options === 'string'
    ? { proxyUrl: options } as DadataSuggestionsOptions
    : options

  const resolveExtraBody = () => (typeof extraBody === 'function' ? extraBody() : extraBody ?? {})

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
        body: JSON.stringify({ query, ...resolveExtraBody() }),
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
