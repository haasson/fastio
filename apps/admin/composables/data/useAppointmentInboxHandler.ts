import { watch, onUnmounted, type Ref } from 'vue'
import { appointmentGroupBus } from '~/composables/data/useAppointmentGroupsChannel'
import { appointmentRequestBus } from '~/composables/data/useAppointmentRequestsChannel'
import { useAppointmentInboxCounter } from '~/composables/data/useAppointmentInboxCounter'
import { useDatabase } from '~/composables/data/useDatabase'
import { reportError } from '~/utils/reportError'

export function useAppointmentInboxHandler(tenantId: Ref<string | null>) {
  const counter = useAppointmentInboxCounter()
  const api = useDatabase()

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const recount = async (tid: string) => {
    try {
      const [g, r] = await Promise.all([
        api.appointmentGroups.countNew(tid),
        api.appointmentRequests.countNew(tid),
      ])

      counter.set(g + r)
    } catch (e) {
      reportError(e)
    }
  }

  const scheduleRecount = () => {
    const tid = tenantId.value

    if (!tid) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => recount(tid), 500)
  }

  watch(tenantId, (tid) => {
    if (tid) recount(tid)
  }, { immediate: true })

  const subs = [
    appointmentGroupBus.onInsert(scheduleRecount),
    appointmentGroupBus.onUpdate(scheduleRecount),
    appointmentGroupBus.onDelete(scheduleRecount),
    appointmentRequestBus.onInsert(scheduleRecount),
    appointmentRequestBus.onUpdate(scheduleRecount),
    appointmentRequestBus.onDelete(scheduleRecount),
  ]

  onUnmounted(() => {
    subs.forEach((off) => off())
    if (debounceTimer) clearTimeout(debounceTimer)
  })
}
