import { ref } from 'vue'
import type { Ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useMessage } from '@fastio/ui'
import type {
  Resource, ServiceWithBranchIds, GroupSlotsResult,
} from '@fastio/shared'
import type { EditorState } from '~/components/appointments/types'
import { useGroupSlotSearch } from '~/composables/data/useGroupSlotSearch'
import { useAppointmentSettingsStore } from '~/stores/appointmentSettings'
import { reportError } from '~/utils/reportError'

/**
 * Обёртка над `useGroupSlotSearch` с debounced-перезагрузкой при изменении
 * даты / филиала / состава услуг. Использует gen-counter для отбрасывания
 * устаревших ответов (если юзер быстро переключает дату).
 *
 * Возвращает `slotsResult` (chip-варианты или request_only), `loadingSlots`
 * и явные ref'ы на ресурсы/услуги (заполняются `loadResourceData` снаружи).
 */
export function useEditorSlots(
  state: EditorState,
  allResources: Ref<Resource[]>,
  allServices: Ref<ServiceWithBranchIds[]>,
) {
  const groupSlotSearch = useGroupSlotSearch()
  const appointmentSettingsStore = useAppointmentSettingsStore()
  const message = useMessage()

  const slotsResult = ref<GroupSlotsResult | null>(null)
  const loadingSlots = ref(false)
  let slotsLoadGen = 0

  const findSlots = async (): Promise<void> => {
    const activeServices = state.services.filter((s) => !s.pendingRemove)

    if (!state.date || activeServices.length === 0) {
      slotsResult.value = null
      loadingSlots.value = false

      return
    }

    const slotStep = appointmentSettingsStore.settings?.slotStepMinutes ?? 30
    const gen = ++slotsLoadGen

    loadingSlots.value = true
    try {
      const result = await groupSlotSearch.findSlots({
        date: state.date,
        branchId: state.branchId,
        slotStepMinutes: slotStep,
        services: activeServices.map((s) => ({
          serviceId: s.serviceId,
          duration: s.durationMinutes,
          preferredResourceId: s.preferredResourceId,
        })),
        candidateResources: allResources.value,
        allServices: allServices.value,
      })

      if (gen !== slotsLoadGen) return
      slotsResult.value = result
    } catch (e) {
      if (gen !== slotsLoadGen) return
      reportError(e)
      slotsResult.value = null
      message.error('Не удалось подобрать варианты времени')
    } finally {
      if (gen === slotsLoadGen) loadingSlots.value = false
    }
  }

  watchDebounced(
    () => ({
      date: state.date,
      branchId: state.branchId,
      services: state.services
        .filter((s) => !s.pendingRemove)
        .map((s) => `${s.serviceId}:${s.durationMinutes}:${s.preferredResourceId ?? ''}`)
        .join('|'),
    }),
    () => { findSlots() },
    { debounce: 300 },
  )

  return { slotsResult, loadingSlots }
}
