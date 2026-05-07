import { watch, onUnmounted, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { visitsBus } from '~/composables/services/useVisitsChannel'
import { useAppointmentInboxCounter } from '~/composables/services/useAppointmentInboxCounter'
import { useDatabase } from '~/composables/data/useDatabase'
import { reportError } from '~/utils/reportError'

// Счётчик «Новых» в инбоксе. После 230 заявка — это визит со status='request',
// отдельной таблицы appointment_requests больше нет. countNew учитывает оба
// случая (request-визит ИЛИ active-визит с услугами в new).
export function useAppointmentInboxHandler(tenantId: Ref<string | null>) {
  const counter = useAppointmentInboxCounter()
  const api = useDatabase()

  const recount = async (tid: string): Promise<void> => {
    try {
      const n = await api.visits.countNew(tid)

      counter.set(n)
    } catch (e) {
      reportError(e)
    }
  }

  // Realtime-подписка на appointment_groups шумит при bulk-bookings (5 услуг = 5
  // INSERT-эвентов в течение ~100ms). Дебаунс 300ms склеивает шквал в один recount.
  const scheduleRecount = useDebounceFn(() => {
    const tid = tenantId.value

    if (!tid) return

    return recount(tid)
  }, 300)

  // Первый recount при mount/смене тенанта — без дебаунса, чтобы бейдж не висел
  // пустым 300ms на старте.
  watch(tenantId, (tid) => {
    if (tid) recount(tid)
  }, { immediate: true })

  const subs = [
    visitsBus.onInsert(scheduleRecount),
    visitsBus.onUpdate(scheduleRecount),
    visitsBus.onDelete(scheduleRecount),
  ]

  onUnmounted(() => {
    subs.forEach((off) => off())
  })
}
