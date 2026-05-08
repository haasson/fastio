import { watch, onUnmounted, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { Visit } from '@fastio/shared'
import { visitsBus } from '~/composables/services/useVisitsChannel'
import { useAppointmentInboxCounter } from '~/composables/services/useAppointmentInboxCounter'
import { useDatabase } from '~/composables/data/useDatabase'
import { useBranchStore } from '~/stores/branch'
import { reportError } from '~/utils/reportError'

// Счётчик «Новых» в инбоксе. После 230 заявка — это визит со status='request',
// отдельной таблицы appointment_requests больше нет. countNew учитывает оба
// случая (request-визит ИЛИ active-визит с услугами в new).
export function useAppointmentInboxHandler(tenantId: Ref<string | null>) {
  const counter = useAppointmentInboxCounter()
  const api = useDatabase()
  const branchStore = useBranchStore()

  const recount = async (tid: string): Promise<void> => {
    try {
      const n = await api.visits.countNew(tid, branchStore.currentBranchId ?? undefined)

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

  // Первый recount при mount/смене тенанта или филиала — без дебаунса,
  // чтобы бейдж не висел пустым 300ms на старте.
  watch([tenantId, () => branchStore.currentBranchId], ([tid]) => {
    if (tid) recount(tid)
  }, { immediate: true })

  const isCurrentBranch = (v: Visit) => !branchStore.currentBranchId || !v.branchId || v.branchId === branchStore.currentBranchId

  const subs = [
    // Фильтр по филиалу — до дебаунса: иначе последний evt в окне 300ms может быть
    // из чужого филиала и дебаунсер пропустит recount нужного нам.
    visitsBus.onInsert((v) => { if (isCurrentBranch(v)) scheduleRecount() }),
    visitsBus.onUpdate((v) => { if (isCurrentBranch(v)) scheduleRecount() }),
    // onDelete получает только { id } без branchId — всегда пересчитываем.
    visitsBus.onDelete(() => scheduleRecount()),
  ]

  onUnmounted(() => {
    subs.forEach((off) => off())
  })
}
