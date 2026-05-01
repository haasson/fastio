import type {
  ResourceSlotData,
  AppointmentInterval,
  GroupSlotOption,
  GroupSlotMatch,
  GroupSlotEntry,
  GroupSlotsResult,
} from '../types/appointment'
import type { WorkingHoursSchedule } from '../types/tenant'
import { getDaySchedule } from './workingHours'
import { timeToMinutes, minutesToTimeStr, localDateTimeToUtcIso, getIsoDayForDate, todayInTz, nowTimeInTz } from './timezone'

/** Дефолтная длина рабочего дня в минутах когда расписание тенанта/филиала не задано. */
export const DEFAULT_WORKING_DAY_MINUTES = 8 * 60

/**
 * Чистая разница в днях между двумя YYYY-MM-DD строками (отрицательная если b < a).
 * Используем UTC чтобы исключить эффект DST.
 */
function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.floor((db - da) / 86_400_000)
}

/**
 * Слоты shift-цикла для конкретной даты (или null если цикла нет).
 */
function shiftSlotsForDate(date: string, data: ResourceSlotData): string[] | null {
  const cycle = data.shiftCycle
  if (!cycle) return null
  const len = cycle.cycleLength
  const offset = daysBetween(cycle.cycleStartDate, date)
  const idx = ((offset % len) + len) % len
  return cycle.slotsByDayIndex[idx] ?? []
}

/**
 * Определяет рабочие часы ресурса на конкретную дату.
 * Возвращает { openTime, closeTime } или null если ресурс не работает.
 *
 * Приоритет: override на дату → shiftCycle → resource_schedules → график филиала.
 */
export function resolveResourceWorkingHours(
  date: string,  // "YYYY-MM-DD"
  data: ResourceSlotData,
): { openTime: string; closeTime: string } | null {
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()  // 0=Sun..6=Sat

  const override = data.dateOverrides.find(o => o.date === date)
  if (override) {
    if (!override.isWorking || !override.openTime || !override.closeTime) {
      return null
    }
    return { openTime: override.openTime, closeTime: override.closeTime }
  }

  // Shift-цикл: окно = [первый слот, последний слот + slotStep). slotStep
  // знает только верхнеуровневый код, поэтому здесь возвращаем границы по
  // первому и последнему slot-time. getResourceSlotsForDate всё равно
  // фильтрует по active set из disabledSlots, так что даже широкое окно
  // не даст лишних слотов.
  const cycleSlots = shiftSlotsForDate(date, data)
  if (cycleSlots !== null) {
    if (cycleSlots.length === 0) return null
    return { openTime: cycleSlots[0], closeTime: '23:59' }
  }

  if (data.schedules.length > 0) {
    const schedule = data.schedules.find(s => s.dayOfWeek === dayOfWeek)
    if (!schedule || !schedule.isWorking || !schedule.openTime || !schedule.closeTime) return null
    return { openTime: schedule.openTime, closeTime: schedule.closeTime }
  }

  // График у ресурса не задан → наследуем филиал.
  if (data.branchSchedule) {
    const isoDay = Number(getIsoDayForDate(date))
    const day = getDaySchedule(data.branchSchedule, isoDay)
    if (day.dayOff) return null
    return { openTime: day.open, closeTime: day.close }
  }

  return null
}

/**
 * Возвращает множество выключенных слотов (строки "HH:MM") для ресурса на дату.
 *
 * Для shift-цикла «выключенные» = все слоты в окне работы, КРОМЕ активных
 * на этот день цикла (active-list переворачивается в disabled-list).
 */
function resolveDisabledSlots(date: string, data: ResourceSlotData, slotStep: number): Set<string> {
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()

  const dateSpecific = data.dateDisabledSlots.filter(s => s.date === date)
  if (dateSpecific.length > 0) {
    return new Set(dateSpecific.map(s => s.slotTime))
  }

  const cycleSlots = shiftSlotsForDate(date, data)
  if (cycleSlots !== null) {
    // Окно — от первого активного слота до последнего + slotStep.
    if (cycleSlots.length === 0) return new Set()
    const active = new Set(cycleSlots)
    const firstMin = timeToMinutes(cycleSlots[0])
    const lastMin = timeToMinutes(cycleSlots[cycleSlots.length - 1])
    const disabled = new Set<string>()
    for (let m = firstMin; m <= lastMin; m += slotStep) {
      const t = minutesToTimeStr(m)
      if (!active.has(t)) disabled.add(t)
    }
    return disabled
  }

  const base = data.disabledSlots.filter(s => s.dayOfWeek === dayOfWeek)
  return new Set(base.map(s => s.slotTime))
}

/**
 * Сколько существующих записей пересекается с интервалом [slotStartUtc, slotEndUtc).
 * Используется вместо булевого hasConflict() для поддержки capacity ресурса.
 */
export function countConflicts(
  slotStartUtc: string,
  slotEndUtc: string,
  appointments: AppointmentInterval[],
): number {
  const start = new Date(slotStartUtc).getTime()
  const end = new Date(slotEndUtc).getTime()
  let count = 0
  for (const a of appointments) {
    const aStart = new Date(a.startsAt).getTime()
    const aEnd = new Date(a.endsAt).getTime()
    if (aStart < end && aEnd > start) count++
  }
  return count
}

/**
 * Доступные слоты для одного ресурса на конкретную дату.
 *
 * Capacity: слот считается занятым только если кол-во пересечений ≥ capacity.
 * Используется для object-ресурсов с несколькими экземплярами (10 бильярдных столов).
 */
export function getResourceSlotsForDate(
  date: string,
  data: ResourceSlotData,
  appointments: AppointmentInterval[],
  duration: number,
  slotStep: number,
  timezone: string,
  capacity: number = 1,
): string[] {
  const hours = resolveResourceWorkingHours(date, data)
  if (!hours) return []

  const openMin = timeToMinutes(hours.openTime)
  const closeMin = timeToMinutes(hours.closeTime)
  if (closeMin <= openMin) return []

  const disabledSet = resolveDisabledSlots(date, data, slotStep)
  const result: string[] = []

  let startMin = Math.ceil(openMin / slotStep) * slotStep

  // Отсекаем прошедшие слоты, если дата = сегодня в таймзоне тенанта
  if (date === todayInTz(timezone)) {
    const nowMin = timeToMinutes(nowTimeInTz(timezone))
    if (nowMin > startMin) startMin = Math.ceil(nowMin / slotStep) * slotStep
  }

  for (let m = startMin; m < closeMin; m += slotStep) {
    if (m + duration > closeMin) break

    const slotTime = minutesToTimeStr(m)
    if (disabledSet.has(slotTime)) continue

    const slotStartUtc = localDateTimeToUtcIso(date, slotTime, timezone)
    const slotEndUtc = localDateTimeToUtcIso(date, minutesToTimeStr(m + duration), timezone)
    if (countConflicts(slotStartUtc, slotEndUtc, appointments) >= capacity) continue

    result.push(slotTime)
  }

  return result
}

/**
 * Объединяет слоты нескольких ресурсов для одной услуги (режим "любой исполнитель").
 */
export function mergeResourceSlots(
  date: string,
  resources: Array<{ data: ResourceSlotData; appointments: AppointmentInterval[]; capacity?: number }>,
  duration: number,
  slotStep: number,
  timezone: string,
): string[] {
  const all = new Set<string>()
  for (const resource of resources) {
    const slots = getResourceSlotsForDate(
      date, resource.data, resource.appointments,
      duration, slotStep, timezone, resource.capacity ?? 1,
    )
    for (const slot of slots) all.add(slot)
  }
  return Array.from(all).sort()
}

/**
 * Слоты для услуги БЕЗ исполнителя — на основе расписания филиала.
 * Capacity параллельных бронирований опциональна (для open_ended/ресурсов с количеством).
 */
export function getBranchSlotsForDate(
  date: string,
  branchSchedule: WorkingHoursSchedule | null,
  appointments: AppointmentInterval[],
  duration: number,
  slotStep: number,
  timezone: string,
  capacity: number = 1,
): string[] {
  if (!branchSchedule) return []

  const isoDay = Number(getIsoDayForDate(date))
  const day = getDaySchedule(branchSchedule, isoDay)
  if (day.dayOff) return []

  const openMin = timeToMinutes(day.open)
  const closeMin = timeToMinutes(day.close)
  if (closeMin <= openMin) return []

  const result: string[] = []
  let startMin = Math.ceil(openMin / slotStep) * slotStep

  if (date === todayInTz(timezone)) {
    const nowMin = timeToMinutes(nowTimeInTz(timezone))
    if (nowMin > startMin) startMin = Math.ceil(nowMin / slotStep) * slotStep
  }

  for (let m = startMin; m < closeMin; m += slotStep) {
    if (m + duration > closeMin) break

    const slotTime = minutesToTimeStr(m)
    const slotStartUtc = localDateTimeToUtcIso(date, slotTime, timezone)
    const slotEndUtc = localDateTimeToUtcIso(date, minutesToTimeStr(m + duration), timezone)
    if (countConflicts(slotStartUtc, slotEndUtc, appointments) >= capacity) continue

    result.push(slotTime)
  }

  return result
}

/**
 * Все теоретически возможные слоты в окне (для UI сетки).
 */
export function getAllSlotsInWindow(
  openTime: string,
  closeTime: string,
  slotStep: number,
): string[] {
  const openMin = timeToMinutes(openTime)
  const closeMin = timeToMinutes(closeTime)
  if (closeMin <= openMin) return []

  const result: string[] = []
  const startMin = Math.ceil(openMin / slotStep) * slotStep
  for (let m = startMin; m < closeMin; m += slotStep) {
    result.push(minutesToTimeStr(m))
  }
  return result
}

/**
 * Эффективный список ID услуг для ресурса:
 * объединение явных через service_resources и услуг в категориях из resource_categories.
 *
 * Если в дальнейшем услугу добавят в категорию, на которую подписан ресурс —
 * она автоматически попадает в эффективный список без явного назначения.
 */
export function getEffectiveServiceIds(
  explicitServiceIds: string[],
  resourceCategoryIds: string[],
  allServices: Array<{ id: string; categoryId: string | null }>,
): string[] {
  const result = new Set<string>(explicitServiceIds)
  if (resourceCategoryIds.length > 0) {
    const catSet = new Set(resourceCategoryIds)
    for (const s of allServices) {
      if (s.categoryId && catSet.has(s.categoryId)) result.add(s.id)
    }
  }
  return Array.from(result)
}

/**
 * Ищет все возможные варианты последовательного расписания для группы услуг на дату.
 *
 * Услуги выполняются строго последовательно: следующая начинается сразу после предыдущей.
 * Для каждого кандидата на старт T перебирает все услуги по порядку и ищет свободный ресурс.
 */
export function findGroupSlots(
  items: Array<{
    serviceId: string
    duration: number
    resourceIds: string[] // все подходящие ресурсы для этой услуги
    resourceNames: Map<string, string> // resourceId → name
    // Изначальный preferred мастер. Если итоговый foundResourceId ≠ этого id —
    // в schedule отметится как «замена» (для UI: зачёркнутое имя старого).
    preferredResourceId?: string | null
    preferredResourceName?: string | null
  }>,
  date: string, // YYYY-MM-DD
  resourceSlotData: Map<string, ResourceSlotData>,
  existingAppointments: Map<string, AppointmentInterval[]>,
  settings: { slotStep: number; timezone: string },
  branchSchedule?: WorkingHoursSchedule | null,
): GroupSlotOption[] {
  if (items.length === 0) return []

  const totalDuration = items.reduce((sum, item) => sum + item.duration, 0)

  // Определяем рабочие часы: берём первый ресурс у которого есть данные,
  // или падаем на branchSchedule
  let workingHours: { openTime: string; closeTime: string } | null = null
  for (const item of items) {
    for (const resourceId of item.resourceIds) {
      const data = resourceSlotData.get(resourceId)
      if (data) {
        workingHours = resolveResourceWorkingHours(date, data)
        if (workingHours) break
      }
    }
    if (workingHours) break
  }

  // Если через ресурсы не нашли — пробуем через branchSchedule напрямую
  if (!workingHours && branchSchedule) {
    const isoDay = Number(getIsoDayForDate(date))
    const day = getDaySchedule(branchSchedule, isoDay)
    if (!day.dayOff) {
      workingHours = { openTime: day.open, closeTime: day.close }
    }
  }

  if (!workingHours) return []

  const openMin = timeToMinutes(workingHours.openTime)
  const closeMin = timeToMinutes(workingHours.closeTime)
  if (closeMin <= openMin) return []

  const { slotStep, timezone } = settings
  let startMin = Math.ceil(openMin / slotStep) * slotStep

  if (date === todayInTz(timezone)) {
    const nowMin = timeToMinutes(nowTimeInTz(timezone))
    if (nowMin > startMin) startMin = Math.ceil(nowMin / slotStep) * slotStep
  }

  const result: GroupSlotOption[] = []

  for (let t = startMin; t + totalDuration <= closeMin; t += slotStep) {
    const schedule: GroupSlotOption['schedule'] = []
    let cursor = t
    let allFit = true

    for (const item of items) {
      let foundResourceId: string | null = null
      let foundResourceName = ''

      for (const resourceId of item.resourceIds) {
        const data = resourceSlotData.get(resourceId)

        // Ресурс должен работать в эту дату (нет override is_working=false и попадает в график).
        if (data) {
          const hours = resolveResourceWorkingHours(date, data)
          if (!hours) continue
          const resOpenMin = timeToMinutes(hours.openTime)
          const resCloseMin = timeToMinutes(hours.closeTime)
          if (cursor < resOpenMin || cursor + item.duration > resCloseMin) continue

          // Disabled-слоты тоже исключаем.
          const disabled = resolveDisabledSlots(date, data, slotStep)
          if (disabled.has(minutesToTimeStr(cursor))) continue
        }

        const appointments = existingAppointments.get(resourceId) ?? []
        const startUtc = localDateTimeToUtcIso(date, minutesToTimeStr(cursor), timezone)
        const endUtc = localDateTimeToUtcIso(date, minutesToTimeStr(cursor + item.duration), timezone)

        if (countConflicts(startUtc, endUtc, appointments) === 0) {
          foundResourceId = resourceId
          foundResourceName = item.resourceNames.get(resourceId) ?? resourceId
          break
        }
      }

      if (foundResourceId === null) {
        allFit = false
        break
      }

      const prefId = item.preferredResourceId ?? null
      const wasReplaced = prefId !== null && prefId !== foundResourceId
      schedule.push({
        serviceId: item.serviceId,
        resourceId: foundResourceId,
        resourceName: foundResourceName,
        preferredResourceId: wasReplaced ? prefId : null,
        preferredResourceName: wasReplaced
          ? (item.preferredResourceName ?? item.resourceNames.get(prefId!) ?? prefId!)
          : null,
        startTime: minutesToTimeStr(cursor),
        endTime: minutesToTimeStr(cursor + item.duration),
      })
      cursor += item.duration
    }

    if (allFit) {
      result.push({
        startTime: minutesToTimeStr(t),
        schedule,
      })
    }
  }

  return result
}

/**
 * Тип «общий» для сборки items: преобразует input-структуру в варианты для findGroupSlots.
 */
function buildPreferredAndAnyItems(
  items: Array<{
    serviceId: string
    duration: number
    allResourceIds: string[]
    preferredResourceId: string | null
    resourceNames: Map<string, string>
  }>,
) {
  const hasAnyPreferences = items.some(item => item.preferredResourceId !== null)

  const preferredItems = items.map(item => ({
    serviceId: item.serviceId,
    duration: item.duration,
    resourceIds: item.preferredResourceId !== null
      ? [item.preferredResourceId]
      : item.allResourceIds,
    resourceNames: item.resourceNames,
  }))

  const anyItems = items.map(item => ({
    serviceId: item.serviceId,
    duration: item.duration,
    resourceIds: item.allResourceIds,
    resourceNames: item.resourceNames,
    preferredResourceId: item.preferredResourceId,
    preferredResourceName: item.preferredResourceId !== null
      ? (item.resourceNames.get(item.preferredResourceId) ?? null)
      : null,
  }))

  return { preferredItems, anyItems, hasAnyPreferences }
}

/**
 * Ищет все доступные слоты для группы услуг на дату — с цветовой маркировкой:
 *
 * - 'preferred' (зелёный) — предпочтительные мастера полностью свободны на этот старт.
 * - 'any' (жёлтый) — на этот старт пришлось взять хотя бы одного «не предпочтительного».
 *
 * Если суммарная длительность > рабочего дня → { type: 'request_only' }.
 *
 * Возвращает entries, отсортированные по startTime. Может быть пустым массивом
 * (тогда UI показывает «свободного времени нет»).
 */
export function findGroupSlotsWithFallback(
  items: Array<{
    serviceId: string
    duration: number
    allResourceIds: string[]
    preferredResourceId: string | null
    resourceNames: Map<string, string>
  }>,
  date: string,
  resourceSlotData: Map<string, ResourceSlotData>,
  existingAppointments: Map<string, AppointmentInterval[]>,
  settings: { slotStep: number; timezone: string },
  workingDayMinutes: number,
  branchSchedule?: WorkingHoursSchedule | null,
): GroupSlotsResult {
  const totalDuration = items.reduce((sum, item) => sum + item.duration, 0)

  if (totalDuration > workingDayMinutes) {
    return { type: 'request_only' }
  }

  const { preferredItems, anyItems, hasAnyPreferences } = buildPreferredAndAnyItems(items)

  const anyOptions = findGroupSlots(
    anyItems, date, resourceSlotData, existingAppointments, settings, branchSchedule,
  )

  if (anyOptions.length === 0) {
    return { type: 'slots', entries: [] }
  }

  // Если ни у одной услуги нет предпочтения — все anyOptions считаются 'preferred'.
  if (!hasAnyPreferences) {
    const entries: GroupSlotEntry[] = anyOptions.map(opt => ({ ...opt, match: 'preferred' as GroupSlotMatch }))
    entries.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    return { type: 'slots', entries }
  }

  const preferredOptions = findGroupSlots(
    preferredItems, date, resourceSlotData, existingAppointments, settings, branchSchedule,
  )
  const preferredByStart = new Map<string, GroupSlotOption>()
  for (const opt of preferredOptions) preferredByStart.set(opt.startTime, opt)

  const entries: GroupSlotEntry[] = anyOptions.map((opt) => {
    const pref = preferredByStart.get(opt.startTime)
    if (pref) return { ...pref, match: 'preferred' as GroupSlotMatch }
    return { ...opt, match: 'any' as GroupSlotMatch }
  })
  entries.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

  return { type: 'slots', entries }
}

/**
 * Лёгкая проверка «есть ли в этой дате хоть один зелёный или жёлтый слот».
 * Используется для подсветки кнопок-дней в стрипе (зелёная точка / жёлтая / пусто).
 *
 * Возвращает 'preferred' если есть хотя бы один зелёный слот, 'any' если только
 * жёлтые, null если ничего нет (или общая длительность > рабочего дня).
 *
 * Реализация — простая: вызывает findGroupSlotsWithFallback и смотрит на entries[0].
 * Не самый дешёвый вариант, но переиспользует одну и ту же логику.
 */
export function getGroupDateAvailability(
  items: Array<{
    serviceId: string
    duration: number
    allResourceIds: string[]
    preferredResourceId: string | null
    resourceNames: Map<string, string>
  }>,
  date: string,
  resourceSlotData: Map<string, ResourceSlotData>,
  existingAppointments: Map<string, AppointmentInterval[]>,
  settings: { slotStep: number; timezone: string },
  workingDayMinutes: number,
  branchSchedule?: WorkingHoursSchedule | null,
): GroupSlotMatch | null {
  const result = findGroupSlotsWithFallback(
    items, date, resourceSlotData, existingAppointments,
    settings, workingDayMinutes, branchSchedule,
  )
  if (result.type !== 'slots') return null
  if (result.entries.length === 0) return null
  return result.entries.some(e => e.match === 'preferred') ? 'preferred' : 'any'
}
