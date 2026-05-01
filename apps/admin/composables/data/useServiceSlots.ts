import { ref } from 'vue'
import type { Ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useMessage } from '@fastio/ui'
import type {
  Resource, ServiceWithBranchIds, GroupSlotsResult,
} from '@fastio/shared'
import { useGroupSlotSearch } from '~/composables/data/useGroupSlotSearch'
import { useAppointmentSettingsStore } from '~/stores/appointmentSettings'
import { reportError } from '~/utils/reportError'

/**
 * Поиск слотов для ОДНОЙ услуги в фиксированный день. Под капотом — тот же
 * `useGroupSlotSearch.findSlots` (с массивом из 1 услуги), но интерфейс
 * упрощён под per-service редактирование на странице визита.
 *
 * Возвращает зелёные/жёлтые чипсы как обычно: preferred → есть свободное время
 * у указанного мастера, any → доступна замена.
 *
 * Гонки: gen-counter отбрасывает устаревшие ответы при быстром переключении услуг.
 */
export type ServiceSlotInput = {
  date: string // "YYYY-MM-DD" — день визита, неизменный
  serviceId: string
  duration: number
  preferredResourceId: string | null
  // ID существующего appointment, который НЕ должен учитываться как
  // занятый при поиске (его собственный слот). Прокидывается в
  // useGroupSlotSearch.findSlots → bulkLoadAvailability фильтрует его из массива.
  excludeAppointmentId: string | null
  branchId: string | null
}

export function useServiceSlots(params: {
  input: Ref<ServiceSlotInput | null>
  candidateResources: Ref<Resource[]>
  allServices: Ref<ServiceWithBranchIds[]>
}) {
  const groupSlotSearch = useGroupSlotSearch()
  const settingsStore = useAppointmentSettingsStore()
  const message = useMessage()

  const result = ref<GroupSlotsResult | null>(null)
  const loading = ref(false)
  let gen = 0

  const recompute = async () => {
    const input = params.input.value
    const myGen = ++gen

    if (!input) {
      result.value = null
      loading.value = false

      return
    }

    const slotStep = settingsStore.settings?.slotStepMinutes ?? 30

    loading.value = true
    try {
      const r = await groupSlotSearch.findSlots({
        date: input.date,
        branchId: input.branchId,
        slotStepMinutes: slotStep,
        services: [{
          serviceId: input.serviceId,
          duration: input.duration,
          preferredResourceId: input.preferredResourceId,
        }],
        candidateResources: params.candidateResources.value,
        allServices: params.allServices.value,
        excludeAppointmentId: input.excludeAppointmentId,
      })

      if (myGen !== gen) return
      result.value = r
    } catch (e) {
      if (myGen !== gen) return
      reportError(e)
      result.value = null
      message.error('Не удалось подобрать слоты')
    } finally {
      if (myGen === gen) loading.value = false
    }
  }

  watchDebounced(
    () => {
      const i = params.input.value

      if (!i) return ''

      return `${i.date}|${i.serviceId}|${i.duration}|${i.preferredResourceId ?? ''}|${i.branchId ?? ''}|${i.excludeAppointmentId ?? ''}`
    },
    () => { recompute() },
    { debounce: 200, immediate: true },
  )

  return { result, loading }
}
