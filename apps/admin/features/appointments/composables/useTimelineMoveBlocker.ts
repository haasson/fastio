import { computed, type Ref } from 'vue'
import type { Appointment, AppointmentSettings, Resource } from '@fastio/shared'
import { DEFAULT_APPOINTMENT_SETTINGS } from '@fastio/shared'
import type { TimelineAvailability } from '../utils/timelineAvailability'

type MovePayload = {
  appt: Appointment
  dyMin: number
  newResourceId: string
}

type Params = {
  availability: Ref<TimelineAvailability>
  resources: Ref<Resource[]>
  appointments: Ref<Appointment[]>
  settings: Ref<AppointmentSettings | null>
  selectedDate: Ref<string>
  todayStr: Ref<string>
  now: Ref<number>
  tz: Ref<string>
  competencyByResource: Ref<Map<string, Set<string>>>
}

/**
 * Pre-flight валидация drag&drop переноса записи. Возвращает функцию-валидатор,
 * которая по новому resource/времени отдаёт причину блокировки или null если
 * перенос разрешён. Используется и для ghost-надписи в драге, и при коммите
 * перед открытием confirm-модалки.
 *
 * Порядок проверок: прошлое → выходной/нет графика → вне рабочих часов →
 * disabled-слот → нет компетенции → конфликт capacity. Конфликт считаем
 * по локальным записям с учётом capacity ресурса (несколько одновременных
 * записей разрешены до cap).
 */
export function useTimelineMoveBlocker(params: Params) {
  const {
    availability, resources, appointments, settings,
    selectedDate, todayStr, now, tz, competencyByResource,
  } = params

  const isoToLocalMinutes = (iso: string): number => {
    const t = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz.value,
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso))
    const [h, m] = t.split(':').map(Number)

    return h * 60 + m
  }

  // Группируем приёмные по resource_id один раз на каждое изменение списка —
  // блокер вызывается из dragGhost computed на каждый кадр drag'а, проход
  // O(n) по всем appointments на каждый вызов слишком расточителен на 200+
  // записей в день.
  const apptsByResource = computed(() => {
    const map = new Map<string, Appointment[]>()

    for (const a of appointments.value) {
      if (!a.resourceId) continue
      if (a.status === 'cancelled') continue
      const arr = map.get(a.resourceId)

      if (arr) arr.push(a)
      else map.set(a.resourceId, [a])
    }

    return map
  })

  const hasConflict = (apptId: string, resourceId: string | null, startMs: number, endMs: number): boolean => {
    if (!resourceId) return false
    const resource = resources.value.find((r) => r.id === resourceId)
    const cap = Math.max(1, resource?.capacity ?? 1)
    const peers = apptsByResource.value.get(resourceId)

    if (!peers || peers.length === 0) return false

    let overlapping = 0

    for (const other of peers) {
      if (other.id === apptId) continue
      const oStart = new Date(other.startsAt).getTime()
      const oEnd = new Date(other.actualEndsAt ?? other.endsAt).getTime()

      if (oStart < endMs && oEnd > startMs) overlapping++
    }

    return overlapping >= cap
  }

  const getMoveBlocker = ({ appt, dyMin, newResourceId }: MovePayload): string | null => {
    const offsetMs = dyMin * 60 * 1000
    const newStartIso = new Date(new Date(appt.startsAt).getTime() + offsetMs).toISOString()
    const newEndIso = new Date(new Date(appt.endsAt).getTime() + offsetMs).toISOString()
    const newActualEndIso = appt.actualEndsAt
      ? new Date(new Date(appt.actualEndsAt).getTime() + offsetMs).toISOString()
      : null
    const endIso = newActualEndIso ?? newEndIso

    if (selectedDate.value === todayStr.value && new Date(newStartIso).getTime() < now.value) {
      return 'В прошлое нельзя'
    }

    const av = availability.value[newResourceId]

    if (!av || !av.workingHours) return 'Мастер не работает'

    const startMin = isoToLocalMinutes(newStartIso)
    let endMin = isoToLocalMinutes(endIso)

    if (endMin <= startMin) endMin += 1440

    const [oh, om] = av.workingHours.openTime.split(':').map(Number)
    const [ch, cm] = av.workingHours.closeTime.split(':').map(Number)
    const openMin = oh * 60 + om
    let closeMin = ch * 60 + cm

    if (closeMin <= openMin) closeMin += 1440

    if (startMin < openMin || endMin > closeMin) return 'Вне рабочих часов'

    const slotStep = settings.value?.slotStepMinutes ?? DEFAULT_APPOINTMENT_SETTINGS.slotStepMinutes

    for (const ds of av.disabledSlots) {
      const [h, m] = ds.split(':').map(Number)
      const dsStart = h * 60 + m
      const dsEnd = dsStart + slotStep

      if (dsStart < endMin && dsEnd > startMin) return 'Нерабочий слот'
    }

    if (appt.serviceId && newResourceId !== appt.resourceId) {
      const compat = competencyByResource.value.get(newResourceId)

      if (compat && !compat.has(appt.serviceId)) return 'Нет компетенции'
    }

    if (hasConflict(appt.id, newResourceId, new Date(newStartIso).getTime(), new Date(endIso).getTime())) {
      return 'Слот занят'
    }

    return null
  }

  return { getMoveBlocker }
}
