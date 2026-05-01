import { ref, computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRouter } from '#imports'
import { useMessage } from '@fastio/ui'
import type { AppointmentGroup, AppointmentRequest } from '@fastio/shared'
import { localDateTimeToUtcIso } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { useAuthStore } from '~/stores/auth'
import { reportError } from '~/utils/reportError'
import type { EditorState } from '~/components/appointments/types'

type SaveDeps = {
  mode: 'create' | 'edit'
  state: EditorState
  initialGroup?: AppointmentGroup | null
  initialRequest?: AppointmentRequest | null
  tz: ComputedRef<string>
  dirty: ComputedRef<boolean>
  slotRequired: ComputedRef<boolean>
  isReadOnly: ComputedRef<boolean>
  takeSnapshot: () => void
}

/**
 * Извлекает запись изменения из ошибки RPC и показывает осмысленное сообщение.
 * Распознаёт собственные коды P0001/P0002 из миграций (см. RAISE EXCEPTION).
 */
const handleSaveError = (e: unknown, message: ReturnType<typeof useMessage>): void => {
  reportError(e)
  const msg = (e as Error)?.message ?? ''

  if (msg.includes('Slot is taken')) message.error('Один из слотов уже занят. Подберите другое время.')
  else if (msg.includes('Cannot add to closed group')) message.error('Нельзя добавить услугу в закрытую группу.')
  else if (msg.includes('Cannot update cancelled appointment') || msg.includes('Cannot update completed appointment')) {
    message.error('Эту услугу уже нельзя редактировать — она закрыта.')
  } else message.error(msg || 'Не удалось сохранить запись')
}

/**
 * Собирает items для `create_appointments_bulk` из выбранного слота и активных
 * услуг state. Порядок строк = порядок state.services (без pendingRemove),
 * соответствует entry.schedule[i] по индексу.
 */
const buildItemsForCreate = (state: EditorState, tz: string) => {
  const entry = state.selectedSlotEntry!
  const date = state.date!

  return state.services
    .filter((s) => !s.pendingRemove)
    .map((svc, i) => {
      const sched = entry.schedule[i]

      return {
        serviceId: svc.serviceId,
        resourceId: sched.resourceId,
        startsAt: localDateTimeToUtcIso(date, sched.startTime, tz),
        endsAt: localDateTimeToUtcIso(date, sched.endTime, tz),
        serviceName: svc.serviceName,
        servicePrice: svc.price,
      }
    })
}

/**
 * Map<_key, scheduleEntry> для edit-mode — позволяет находить расписание по
 * ключу услуги независимо от того, добавлена она или существующая.
 */
const buildScheduleByKey = (state: EditorState) => {
  const entry = state.selectedSlotEntry!
  const active = state.services.filter((s) => !s.pendingRemove)
  const map = new Map<string, (typeof entry.schedule)[number]>()

  for (let i = 0; i < active.length; i++) map.set(active[i]._key, entry.schedule[i])

  return map
}

export function useEditorSave(deps: SaveDeps) {
  const router = useRouter()
  const api = useDatabase()
  const tenantStore = useTenantStore()
  const authStore = useAuthStore()
  const message = useMessage()

  const saving = ref(false)

  const canSave = computed<boolean>(() => {
    if (deps.isReadOnly.value) return false
    if (!deps.state.customerName.trim() || !deps.state.customerPhone.trim()) return false
    if (deps.slotRequired.value && !deps.state.selectedSlotEntry) return false

    return true
  })

  const saveCreate = async (): Promise<void> => {
    const tenantId = tenantStore.currentTenantId

    if (!tenantId) throw new Error('Тенант не выбран')

    const result = await api.appointmentGroups.createBulk({
      tenantId,
      branchId: deps.state.branchId,
      customerId: null,
      customerName: deps.state.customerName.trim(),
      customerPhone: deps.state.customerPhone.trim(),
      customerEmail: deps.state.customerEmail.trim() || null,
      notes: deps.state.notes.trim() || null,
      items: buildItemsForCreate(deps.state, deps.tz.value),
      autoConfirm: true,
      allowReschedule: false,
      allowCancel: false,
      source: deps.initialRequest ? 'request' : 'admin',
    })

    if (deps.initialRequest) {
      const userId = authStore.user?.id

      if (userId) {
        try {
          await api.appointmentRequests.markConverted(deps.initialRequest.id, result.groupId, userId)
        } catch (e) {
          reportError(e)
          message.warning('Запись создана, но не удалось пометить заявку как обработанную.')
        }
      }
      try {
        await api.appointmentGroups.updateMeta(result.groupId, { requestId: deps.initialRequest.id })
      } catch (e) {
        reportError(e)
      }
    }

    message.success('Запись сохранена')

    const path = deps.initialRequest
      ? `/appointments/groups/${result.groupId}?fromRequest=${deps.initialRequest.id}`
      : `/appointments/groups/${result.groupId}`

    await router.push(path)
  }

  // Edit-flow: cancel/reschedule паралелим (разные appointment_id, advisory locks
  // не конфликтуют), addToGroup — последовательно (если две новые услуги попадают
  // на одного мастера, параллельные INSERT'ы прошли бы capacity-проверку и упали
  // в гонке). Порядок этапов: cancel → reschedule → addToGroup. Cancel первым
  // освобождает слоты, иначе reschedule уперся бы в «Slot is taken» от тех же
  // записей, которые мы и так удаляем. После addToGroup пишем appointmentId в
  // state, иначе повторный save задублирует INSERT.
  const saveEdit = async (): Promise<void> => {
    const groupId = deps.initialGroup!.id
    const date = deps.state.date!
    const tzVal = deps.tz.value

    await api.appointmentGroups.updateMeta(groupId, {
      customerName: deps.state.customerName.trim(),
      customerPhone: deps.state.customerPhone.trim(),
      customerEmail: deps.state.customerEmail.trim() || null,
      notes: deps.state.notes.trim() || null,
      branchId: deps.state.branchId,
    })

    if (deps.slotRequired.value && deps.state.selectedSlotEntry) {
      const scheduleByKey = buildScheduleByKey(deps.state)

      const toCancel = deps.state.services.filter((s) => s.pendingRemove && s.appointmentId)

      await Promise.all(toCancel.map((svc) => api.appointments.cancel(
        svc.appointmentId!, 'Изменено в редакторе', 'admin',
      )))

      const toReschedule = deps.state.services.filter((s) => !s.pendingRemove && s.appointmentId)

      await Promise.all(toReschedule.map((svc) => {
        const sched = scheduleByKey.get(svc._key)!

        return api.appointments.reschedule(svc.appointmentId!, {
          resourceId: sched.resourceId,
          startsAt: localDateTimeToUtcIso(date, sched.startTime, tzVal),
          endsAt: localDateTimeToUtcIso(date, sched.endTime, tzVal),
          serviceId: svc.serviceId,
          serviceName: svc.serviceName,
          servicePrice: svc.price,
        })
      }))

      for (const svc of deps.state.services.filter((s) => !s.pendingRemove && !s.appointmentId)) {
        const sched = scheduleByKey.get(svc._key)!

        const created = await api.appointments.addToGroup({
          groupId,
          serviceId: svc.serviceId,
          resourceId: sched.resourceId,
          startsAt: localDateTimeToUtcIso(date, sched.startTime, tzVal),
          endsAt: localDateTimeToUtcIso(date, sched.endTime, tzVal),
          serviceName: svc.serviceName,
          servicePrice: svc.price,
        })

        svc.appointmentId = created.id
      }
    }

    deps.state.services = deps.state.services.filter((s) => !s.pendingRemove)
    deps.state.selectedSlotEntry = null
    deps.takeSnapshot()
  }

  const save = async (): Promise<boolean> => {
    if (!deps.dirty.value || !canSave.value || saving.value) return false
    saving.value = true
    try {
      if (deps.mode === 'create') {
        await saveCreate()
      } else {
        await saveEdit()
        message.success('Запись сохранена')
      }

      return true
    } catch (e) {
      handleSaveError(e, message)

      return false
    } finally {
      saving.value = false
    }
  }

  return { save, saving, canSave }
}

export type UseEditorSaveReturn = ReturnType<typeof useEditorSave>
