import { ref, watch, type Ref } from 'vue'
import type { EditorService } from '../../components/types'
import type { useServiceSlots } from '~/features/services-catalog'

type SlotsResultRef = ReturnType<typeof useServiceSlots>['result']

type Params = {
  selectedService: Ref<EditorService | null>
  slotsResult: SlotsResultRef
  applySlot: (slot: { startTime: string; endTime: string; resourceId: string }) => void
  initialSlotTime: string | null
  /**
   * Колбэк ровно один раз — когда initial-pending слот применился к state.
   * Нужен для синхронизации snapshot'а в editor: useEditorSlotApply мутирует
   * state.services[0].current* асинхронно (через debounce slotsResult), и без
   * этого колбэка snapshot, снятый сразу после `prefill`, окажется устаревшим
   * → dirty=true без действий юзера → useUnsavedGuard блокирует router.push.
   */
  onInitialApply?: () => void
}

/**
 * Авто-применение слота-подсказки из preset (например, ?slotTime=HH:MM с таймлайна
 * или конец предыдущей услуги при добавлении следующей).
 *
 * После успеха или промаха pendingSlotTime обнуляется — это ОДНОРАЗОВАЯ
 * подсказка, не sticky-предпочтение. Если для подсказанного времени ни один
 * мастер не свободен, entry не найдётся, юзер выберет руками. Молчаливый промах
 * — норм UX (не показываем ошибки, чипсы остаются как обычно).
 *
 * Если у выбранной услуги задан preferredResourceId, ищем сначала entry того
 * же мастера; иначе — любой entry с подходящим временем.
 */
export function useEditorSlotApply({
  selectedService, slotsResult, applySlot, initialSlotTime, onInitialApply,
}: Params) {
  const pendingSlotTime = ref<string | null>(initialSlotTime)
  // True пока ждём applySlot для initialSlotTime — после первого успешного
  // применения дёргаем onInitialApply один раз. Подсказки от addService
  // (новая услуга после первой) уже после snapshot'а — для них колбэк
  // не нужен.
  let initialPending = initialSlotTime !== null
  let initialFired = false

  const primeSlotTime = (time: string | null) => {
    pendingSlotTime.value = time
  }

  watch(slotsResult, (r) => {
    if (!pendingSlotTime.value) return
    if (!r || r.type !== 'slots') return
    if (!selectedService.value) return

    const target = pendingSlotTime.value
    const preferredRid = selectedService.value.preferredResourceId

    let entry = preferredRid
      ? r.entries.find((e) => e.startTime === target
        && e.match === 'preferred'
        && e.schedule[0].resourceId === preferredRid)
      : undefined

    if (!entry) entry = r.entries.find((e) => e.startTime === target)

    pendingSlotTime.value = null

    if (!entry) {
      // Initial slot не нашёлся — onInitialApply не зовём (state не менялся,
      // snapshot не нужно пересчитывать). Сбрасываем флаг чтобы случайные
      // дальнейшие пустые ответы не дёрнули колбэк.
      initialPending = false

      return
    }

    applySlot({
      startTime: entry.schedule[0].startTime,
      endTime: entry.schedule[0].endTime,
      resourceId: entry.schedule[0].resourceId,
    })

    if (initialPending && !initialFired) {
      initialFired = true
      initialPending = false
      onInitialApply?.()
    }
  })

  return { pendingSlotTime, primeSlotTime }
}
