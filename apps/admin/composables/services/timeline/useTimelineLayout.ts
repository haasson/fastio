import { computed, type Ref } from 'vue'
import type { Appointment, Resource } from '@fastio/shared'
import { timeToMinutes, minutesToTimeStr } from '@fastio/shared'
import type { TimelineAvailability } from '~/utils/services/timelineAvailability'

type SlotEntry = { minutes: number; top: number; time: string }
type DimRange = { top: number; height: number; kind: 'off-hours' | 'disabled' }

export type ColumnModel = {
  resource: Resource
  slots: SlotEntry[]
  dimRanges: DimRange[]
  appointments: Appointment[]
}

type Params = {
  resources: Ref<Resource[]>
  appointments: Ref<Appointment[]>
  availability: Ref<TimelineAvailability>
  windowOpen: Ref<string>
  windowClose: Ref<string>
  slotStep: Ref<number>
  pxPerMin: Ref<number>
  tz: Ref<string>
  now: Ref<number | null>
  dateIsToday: Ref<boolean>
}

/**
 * Геометрия таймлайна: окно, тики часов, колонки ресурсов, позиция карточек.
 *
 * Считает один источник правды для всего, что зависит от windowOpen/Close +
 * pxPerMin: высота полотна, координаты слотов, dim-полосы (off-hours/disabled),
 * позиция now-линии, координаты appt-карточек. Drag-логика и scroll-API
 * подхватывают отсюда `windowStartMin` + `isoToWindowMinutes`.
 */
export function useTimelineLayout(params: Params) {
  const {
    resources, appointments, availability,
    windowOpen, windowClose, slotStep, pxPerMin,
    tz, now, dateIsToday,
  } = params

  const windowStartMin = computed(() => timeToMinutes(windowOpen.value))
  const windowEndMin = computed(() => {
    const close = timeToMinutes(windowClose.value)

    return close <= windowStartMin.value ? close + 1440 : close
  })
  const totalMin = computed(() => windowEndMin.value - windowStartMin.value)
  const totalPx = computed(() => totalMin.value * pxPerMin.value)
  const slotHeightPx = computed(() => slotStep.value * pxPerMin.value)

  const hourTicks = computed(() => {
    const ticks: { minutes: number; top: number; label: string }[] = []
    const start = windowStartMin.value
    const end = windowEndMin.value
    const firstHour = Math.ceil(start / 60) * 60
    const lastHour = Math.floor(end / 60) * 60

    for (let m = firstHour; m <= lastHour; m += 60) {
      ticks.push({
        minutes: m,
        top: (m - start) * pxPerMin.value,
        label: minutesToTimeStr(m),
      })
    }

    return ticks
  })

  const toLocalMinutes = (iso: string): number => {
    const t = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz.value,
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso))
    const [h, m] = t.split(':').map(Number)

    return h * 60 + m
  }

  // Сдвигает minutes на +1440, если окно overnight (windowEnd > 1440) и значение
  // попадает на «следующий день» окна. Окно 22:00–06:00 → windowStart=1320,
  // windowEnd=1800. Время 04:00 (min=240) сдвигается до 1680, внутрь окна.
  const wrapToWindowMin = (min: number): number => (
    windowEndMin.value > 1440 && min < windowStartMin.value ? min + 1440 : min
  )

  // ISO → минуты от полуночи в tz, нормализованные под текущее окно.
  // Используется и для now-линии, и для позиции карточек, и для drag-ghost.
  const isoToWindowMinutes = (iso: string): number => wrapToWindowMin(toLocalMinutes(iso))

  const nowMinutes = computed<number | null>(() => {
    if (now.value === null) return null
    const iso = new Date(now.value).toISOString()
    const min = isoToWindowMinutes(iso)

    if (min < windowStartMin.value || min > windowEndMin.value) return null

    return min
  })

  const nowTop = computed<number | null>(() => {
    if (nowMinutes.value === null) return null

    return (nowMinutes.value - windowStartMin.value) * pxPerMin.value
  })

  const apptsByResource = computed(() => {
    const map: Record<string, Appointment[]> = {}

    for (const a of appointments.value) {
      if (!a.resourceId) continue
      if (!map[a.resourceId]) map[a.resourceId] = []
      map[a.resourceId].push(a)
    }

    return map
  })

  const resolveResourceWindow = (rid: string): { startMin: number; endMin: number } | null => {
    const wh = availability.value[rid]?.workingHours

    if (!wh) return null

    let resStart = timeToMinutes(wh.openTime)
    let resEnd = timeToMinutes(wh.closeTime)

    if (resEnd <= resStart) resEnd += 1440

    if (resStart < windowStartMin.value && resEnd <= windowStartMin.value) {
      resStart += 1440
      resEnd += 1440
    }

    const start = Math.max(resStart, windowStartMin.value)
    const end = Math.min(resEnd, windowEndMin.value)

    if (start >= end) return null

    return { startMin: start, endMin: end }
  }

  // На сегодняшнюю дату слоты до текущего момента — прошлое: на них нельзя записать.
  // Округляем `now` ВВЕРХ до конца текущего слота, чтобы и сам активный слот тоже
  // не был кликабелен (его старт уже прошёл).
  const pastCutoffMin = computed<number | null>(() => {
    if (!dateIsToday.value || nowMinutes.value === null) return null

    return Math.ceil(nowMinutes.value / slotStep.value) * slotStep.value
  })

  const columnsModel = computed<ColumnModel[]>(() => resources.value.map((resource) => {
    const win = resolveResourceWindow(resource.id)
    const disabledTimes = new Set(availability.value[resource.id]?.disabledSlots ?? [])
    const pastMin = pastCutoffMin.value

    const slots: SlotEntry[] = []
    const dimRanges: DimRange[] = []

    if (pastMin !== null && pastMin > windowStartMin.value) {
      const cap = Math.min(pastMin, windowEndMin.value)

      dimRanges.push({
        top: 0,
        height: (cap - windowStartMin.value) * pxPerMin.value,
        kind: 'off-hours',
      })
    }

    if (!win) {
      dimRanges.push({ top: 0, height: totalPx.value, kind: 'off-hours' })
    } else {
      const { startMin, endMin } = win

      if (startMin > windowStartMin.value) {
        dimRanges.push({
          top: 0,
          height: (startMin - windowStartMin.value) * pxPerMin.value,
          kind: 'off-hours',
        })
      }

      if (endMin < windowEndMin.value) {
        dimRanges.push({
          top: (endMin - windowStartMin.value) * pxPerMin.value,
          height: (windowEndMin.value - endMin) * pxPerMin.value,
          kind: 'off-hours',
        })
      }

      for (let m = startMin; m + slotStep.value <= endMin; m += slotStep.value) {
        const time = minutesToTimeStr(m)
        const top = (m - windowStartMin.value) * pxPerMin.value

        if (pastMin !== null && m < pastMin) continue

        if (disabledTimes.has(time)) {
          dimRanges.push({ top, height: slotHeightPx.value, kind: 'disabled' })
        } else {
          slots.push({ minutes: m, top, time })
        }
      }
    }

    return {
      resource,
      slots,
      dimRanges,
      appointments: apptsByResource.value[resource.id] || [],
    }
  }))

  const cardStyle = (a: Appointment): { top: string; height: string } => {
    const startMin = isoToWindowMinutes(a.startsAt)
    const endIso = a.actualEndsAt ?? a.endsAt
    let endMin = isoToWindowMinutes(endIso)

    // Запись 23:00–01:00: end в локальных минутах = 60 < startMin=1380.
    // Сдвигаем end на +1440, длительность сохраняется.
    if (endMin <= startMin) endMin += 1440

    const top = (startMin - windowStartMin.value) * pxPerMin.value
    const height = (endMin - startMin) * pxPerMin.value

    return { top: `${top}px`, height: `${height}px` }
  }

  return {
    windowStartMin,
    windowEndMin,
    totalMin,
    totalPx,
    slotHeightPx,
    hourTicks,
    isoToWindowMinutes,
    nowMinutes,
    nowTop,
    columnsModel,
    cardStyle,
  }
}
