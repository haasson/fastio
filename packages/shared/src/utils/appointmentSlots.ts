import type {
  ResourceSlotData,
  AppointmentInterval,
  GroupSlotOption,
  GroupSlotMatch,
  GroupSlotEntry,
  GroupSlotsResult,
} from '../types/appointment'
import type { WorkingHoursSchedule } from '../types/tenant'
import { getScheduleForDate } from './workingHours'
import {
  timeToMinutes, minutesToTimeStr,
  localDateTimeToUtcIso, localMinutesToUtcIso,
  getIsoDayForDate, todayInTz, nowTimeInTz,
} from './timezone'

/** Дефолтная длина рабочего дня в минутах когда расписание тенанта/филиала не задано. */
export const DEFAULT_WORKING_DAY_MINUTES = 8 * 60

/**
 * Слот для overnight-aware UI/submission. `time` — нормализованное "HH:MM"
 * локального времени слота. `isNextDay=true` означает что слот в фазе D+1
 * смены, начавшейся в D (например, смена 22:00→04:00 на дате D имеет слоты
 * 22:00..23:30 с isNextDay=false и 00:00..03:00 с isNextDay=true).
 *
 * Для нон-overnight расписаний isNextDay всегда false.
 */
export type SlotEntry = { time: string; isNextDay: boolean }

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
 * Результат `shiftHoursForDate`. Discriminated union вместо `null|undefined|object`
 * — TS-проверка не даёт перепутать «цикла нет» и «цикл есть, день выходной».
 *   no-cycle — у ресурса не привязан shift-цикл ⇒ фолбек на schedules/branch;
 *   day-off  — цикл есть, но конкретный день цикла объявлен выходным (часы=null);
 *   working  — конкретные часы работы на день цикла.
 */
type ShiftHoursResult =
  | { kind: 'no-cycle' }
  | { kind: 'day-off' }
  | { kind: 'working'; openTime: string; closeTime: string }

function shiftHoursForDate(date: string, data: ResourceSlotData): ShiftHoursResult {
  const cycle = data.shiftCycle
  if (!cycle) return { kind: 'no-cycle' }

  const len = cycle.cycleLength
  const offset = daysBetween(cycle.cycleStartDate, date)
  const idx = ((offset % len) + len) % len
  const hours = cycle.hoursByDayIndex[idx]
  if (!hours) return { kind: 'day-off' }
  return { kind: 'working', openTime: hours.openTime, closeTime: hours.closeTime }
}

/**
 * Пересекает два временных окна с поддержкой overnight (close <= open значит
 * закрытие следующих суток). Возвращает результирующее окно в HH:MM
 * (нормализованные мод 1440), или null если окна не пересекаются.
 *
 * Если пересечение целиком в D+1 (start >= 1440 минут) — возвращаем null,
 * потому что бронирование на дату D в эту фазу не имеет смысла: запрос на
 * D+1 явный (юзер выберет следующую дату).
 */
function intersectWindows(
  a: { openTime: string; closeTime: string },
  b: { openTime: string; closeTime: string },
): { openTime: string; closeTime: string } | null {
  const aOpen = timeToMinutes(a.openTime)
  const aCloseRaw = timeToMinutes(a.closeTime)
  const aClose = aCloseRaw <= aOpen ? aCloseRaw + 1440 : aCloseRaw

  const bOpen = timeToMinutes(b.openTime)
  const bCloseRaw = timeToMinutes(b.closeTime)
  const bClose = bCloseRaw <= bOpen ? bCloseRaw + 1440 : bCloseRaw

  const open = Math.max(aOpen, bOpen)
  const close = Math.min(aClose, bClose)

  if (open >= close) return null
  if (open >= 1440) return null

  return {
    openTime: minutesToTimeStr(open),
    closeTime: minutesToTimeStr(close),
  }
}

/**
 * Часы филиала на дату.
 *   null    — филиал в этот день закрыт (день-off);
 *  'allDay' — открыт круглосуточно, нет границ для пересечения;
 *  объект   — конкретное окно работы.
 */
function branchHoursForDate(
  date: string,
  branchSchedule: ResourceSlotData['branchSchedule'],
): { openTime: string; closeTime: string } | 'allDay' | null {
  if (!branchSchedule) return null
  const day = getScheduleForDate(branchSchedule, date)
  if (day.dayOff) return null
  if (day.allDay) return 'allDay'
  return { openTime: day.open, closeTime: day.close }
}

/**
 * Определяет рабочие часы ресурса на конкретную дату.
 * Возвращает { openTime, closeTime } или null если ресурс не работает.
 *
 * Приоритет: override на дату → shiftCycle → resource_schedules → график филиала.
 *
 * Если у ресурса есть свой график И задан график филиала, итоговое окно =
 * пересечение собственных часов ресурса с часами филиала. Без этого можно
 * было выставить мастеру 22:00→04:00, а филиал работает до 22:00 — слоты
 * появлялись после закрытия заведения.
 *
 * close < open означает overnight (закрытие следующего календарного дня).
 */
export function resolveResourceWorkingHours(
  date: string,  // "YYYY-MM-DD"
  data: ResourceSlotData,
): { openTime: string; closeTime: string } | null {
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()  // 0=Sun..6=Sat

  // Собственные часы ресурса (без учёта филиала). Может быть null если ресурс
  // не работает (день-off override / выходной по shift-циклу / weekly day-off).
  let ownHours: { openTime: string; closeTime: string } | null = null
  let hasOwnSchedule = false

  const override = data.dateOverrides.find(o => o.date === date)
  if (override) {
    hasOwnSchedule = true
    if (override.isWorking && override.openTime && override.closeTime) {
      ownHours = { openTime: override.openTime, closeTime: override.closeTime }
    }
  } else {
    const cycle = shiftHoursForDate(date, data)
    if (cycle.kind !== 'no-cycle') {
      // Цикл задан — даже если выходной, фолбек на schedules НЕ происходит.
      // Цикл — самодостаточная декларация графика.
      hasOwnSchedule = true
      ownHours = cycle.kind === 'working'
        ? { openTime: cycle.openTime, closeTime: cycle.closeTime }
        : null
    } else if (data.schedules.length > 0) {
      hasOwnSchedule = true
      const schedule = data.schedules.find(s => s.dayOfWeek === dayOfWeek)
      if (schedule && schedule.isWorking && schedule.openTime && schedule.closeTime) {
        ownHours = { openTime: schedule.openTime, closeTime: schedule.closeTime }
      }
    }
  }

  // Если у ресурса нет собственного графика — наследуем филиал.
  if (!hasOwnSchedule) {
    const branch = branchHoursForDate(date, data.branchSchedule)
    if (branch === null) return null
    if (branch === 'allDay') return { openTime: '00:00', closeTime: '24:00' }
    return branch
  }

  if (!ownHours) return null

  // Пересекаем с графиком филиала (если задан). Если филиал в этот день
  // закрыт — ресурс тоже не работает. Если филиал 24/7 — границ нет,
  // используем часы ресурса как есть.
  const branchHours = branchHoursForDate(date, data.branchSchedule)
  if (branchHours === null) return data.branchSchedule ? null : ownHours
  if (branchHours === 'allDay') return ownHours

  return intersectWindows(ownHours, branchHours)
}

/**
 * Возвращает множество выключенных слотов (строки "HH:MM") для ресурса на дату.
 *
 * Для shift-цикла перерывов внутри смены нет — рабочие/выходные дни декларируются
 * целиком через hoursByDayIndex (выходной = day=null). Точечные dateDisabledSlots
 * всё ещё применяются (это пользовательская правка отдельного слота).
 */
function resolveDisabledSlots(date: string, data: ResourceSlotData): Set<string> {
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()

  const dateSpecific = data.dateDisabledSlots.filter(s => s.date === date)
  if (dateSpecific.length > 0) {
    return new Set(dateSpecific.map(s => s.slotTime))
  }

  // Для shift-цикла weekly disabledSlots не применяются — у цикла своё определение
  // рабочих/выходных через hoursByDayIndex.
  if (data.shiftCycle) return new Set()

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
 * Поддерживает overnight (close < open) — окно растягивается на следующие
 * сутки. Слоты во второй половине окна (m >= 1440) возвращаются с
 * isNextDay=true.
 */
export function getResourceSlotsForDate(
  date: string,
  data: ResourceSlotData,
  appointments: AppointmentInterval[],
  duration: number,
  slotStep: number,
  timezone: string,
  capacity: number = 1,
): SlotEntry[] {
  const hours = resolveResourceWorkingHours(date, data)
  if (!hours) return []

  const openMin = timeToMinutes(hours.openTime)
  const closeMinRaw = timeToMinutes(hours.closeTime)
  const overnight = closeMinRaw <= openMin
  const closeMin = overnight ? closeMinRaw + 1440 : closeMinRaw

  const disabledSet = resolveDisabledSlots(date, data)
  const result: SlotEntry[] = []

  const startMin = Math.ceil(openMin / slotStep) * slotStep

  // today-cutoff через UTC сравнение (универсально для overnight и обычного).
  const isToday = date === todayInTz(timezone)
  const nowUtcMs = isToday ? Date.now() : 0

  for (let m = startMin; m < closeMin; m += slotStep) {
    if (m + duration > closeMin) break

    const isNextDay = m >= 1440
    const slotTimeNorm = minutesToTimeStr(m)
    if (disabledSet.has(slotTimeNorm)) continue

    const slotStartUtc = localMinutesToUtcIso(date, m, timezone)
    const slotEndUtc = localMinutesToUtcIso(date, m + duration, timezone)

    if (isToday && new Date(slotStartUtc).getTime() <= nowUtcMs) continue
    if (countConflicts(slotStartUtc, slotEndUtc, appointments) >= capacity) continue

    result.push({ time: slotTimeNorm, isNextDay })
  }

  return result
}

/**
 * Объединяет слоты нескольких ресурсов для одной услуги (режим "любой исполнитель").
 * Дедуп по time+isNextDay; сортировка: сначала слоты текущего дня по времени,
 * потом overnight-фаза следующего дня.
 */
export function mergeResourceSlots(
  date: string,
  resources: Array<{ data: ResourceSlotData; appointments: AppointmentInterval[]; capacity?: number }>,
  duration: number,
  slotStep: number,
  timezone: string,
): SlotEntry[] {
  const map = new Map<string, SlotEntry>()
  for (const resource of resources) {
    const slots = getResourceSlotsForDate(
      date, resource.data, resource.appointments,
      duration, slotStep, timezone, resource.capacity ?? 1,
    )
    for (const slot of slots) {
      const key = `${slot.isNextDay ? '1' : '0'}|${slot.time}`
      if (!map.has(key)) map.set(key, slot)
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.isNextDay !== b.isNextDay) return a.isNextDay ? 1 : -1
    return a.time.localeCompare(b.time)
  })
}

/**
 * Слоты для услуги БЕЗ исполнителя — на основе расписания филиала.
 * Capacity параллельных бронирований опциональна (для open_ended/ресурсов с количеством).
 * Поддерживает overnight филиалы (close < open).
 */
export function getBranchSlotsForDate(
  date: string,
  branchSchedule: WorkingHoursSchedule | null,
  appointments: AppointmentInterval[],
  duration: number,
  slotStep: number,
  timezone: string,
  capacity: number = 1,
): SlotEntry[] {
  if (!branchSchedule) return []

  const day = getScheduleForDate(branchSchedule, date)
  if (day.dayOff) return []

  const openMin = timeToMinutes(day.open)
  const closeMinRaw = timeToMinutes(day.close)
  const overnight = closeMinRaw <= openMin
  const closeMin = overnight ? closeMinRaw + 1440 : closeMinRaw

  const result: SlotEntry[] = []
  const startMin = Math.ceil(openMin / slotStep) * slotStep

  const isToday = date === todayInTz(timezone)
  const nowUtcMs = isToday ? Date.now() : 0

  for (let m = startMin; m < closeMin; m += slotStep) {
    if (m + duration > closeMin) break

    const isNextDay = m >= 1440
    const slotTimeNorm = minutesToTimeStr(m)
    const slotStartUtc = localMinutesToUtcIso(date, m, timezone)
    const slotEndUtc = localMinutesToUtcIso(date, m + duration, timezone)

    if (isToday && new Date(slotStartUtc).getTime() <= nowUtcMs) continue
    if (countConflicts(slotStartUtc, slotEndUtc, appointments) >= capacity) continue

    result.push({ time: slotTimeNorm, isNextDay })
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
    const day = getScheduleForDate(branchSchedule, date)
    if (!day.dayOff) {
      workingHours = { openTime: day.open, closeTime: day.close }
    }
  }

  if (!workingHours) return []

  const openMin = timeToMinutes(workingHours.openTime)
  const closeMinRaw = timeToMinutes(workingHours.closeTime)
  // Overnight: окно растягивается на следующие сутки. Слоты внутри
  // [openMin, closeMinAdj) с возможным cursor >= 1440 (часть в D+1).
  const overnight = closeMinRaw <= openMin
  const closeMinAdj = overnight ? closeMinRaw + 1440 : closeMinRaw

  const { slotStep, timezone } = settings
  const startMin = Math.ceil(openMin / slotStep) * slotStep

  // today-cutoff через UTC сравнение (универсально для overnight и обычного).
  const isToday = date === todayInTz(timezone)
  const nowUtcMs = isToday ? Date.now() : 0

  const result: GroupSlotOption[] = []

  for (let t = startMin; t + totalDuration <= closeMinAdj; t += slotStep) {
    const slotStartUtcMs = new Date(localMinutesToUtcIso(date, t, timezone)).getTime()
    if (isToday && slotStartUtcMs <= nowUtcMs) continue

    const schedule: GroupSlotOption['schedule'] = []
    let cursor = t
    let allFit = true

    for (const item of items) {
      // Собираем ВСЕХ свободных ресурсов в этот слот (для UI выбора замены).
      // foundResourceId = первый из найденных (или preferred если он свободен).
      const freeResourceIds: string[] = []

      for (const resourceId of item.resourceIds) {
        const data = resourceSlotData.get(resourceId)

        if (data) {
          const hours = resolveResourceWorkingHours(date, data)
          if (!hours) continue
          const resOpenMin = timeToMinutes(hours.openTime)
          const resCloseMinRaw = timeToMinutes(hours.closeTime)
          const resOvernight = resCloseMinRaw <= resOpenMin
          const resCloseMinAdj = resOvernight ? resCloseMinRaw + 1440 : resCloseMinRaw
          if (cursor < resOpenMin || cursor + item.duration > resCloseMinAdj) continue

          const disabled = resolveDisabledSlots(date, data)
          // disabledSet хранит ключи как "HH:MM" в нормализованном виде. Для
          // overnight cursor >= 1440 нормализация (минуты mod 1440) даёт корректное
          // 'HH:MM' клочкового времени.
          if (disabled.has(minutesToTimeStr(cursor))) continue
        }

        const appointments = existingAppointments.get(resourceId) ?? []
        const startUtc = localMinutesToUtcIso(date, cursor, timezone)
        const endUtc = localMinutesToUtcIso(date, cursor + item.duration, timezone)

        if (countConflicts(startUtc, endUtc, appointments) === 0) {
          freeResourceIds.push(resourceId)
        }
      }

      if (freeResourceIds.length === 0) {
        allFit = false
        break
      }

      // Если предпочтительный мастер среди свободных — берём его, иначе первого.
      const prefId = item.preferredResourceId ?? null
      const foundResourceId = (prefId !== null && freeResourceIds.includes(prefId))
        ? prefId
        : freeResourceIds[0]
      const foundResourceName = item.resourceNames.get(foundResourceId) ?? foundResourceId

      const wasReplaced = prefId !== null && prefId !== foundResourceId
      const itemEnd = cursor + item.duration
      schedule.push({
        serviceId: item.serviceId,
        resourceId: foundResourceId,
        resourceName: foundResourceName,
        preferredResourceId: wasReplaced ? prefId : null,
        preferredResourceName: wasReplaced
          ? (item.preferredResourceName ?? item.resourceNames.get(prefId!) ?? prefId!)
          : null,
        startTime: minutesToTimeStr(cursor),
        startIsNextDay: cursor >= 1440,
        endTime: minutesToTimeStr(itemEnd),
        endIsNextDay: itemEnd >= 1440,
        availableResourceIds: freeResourceIds,
      })
      cursor = itemEnd
    }

    if (allFit) {
      result.push({
        startTime: minutesToTimeStr(t),
        startIsNextDay: t >= 1440,
        schedule,
      })
    }
  }

  return result
}

/**
 * Все перестановки массива. Используется в findGroupSlotsWithFallback чтобы найти
 * стартовые времена, недоступные в исходном порядке услуг (см. план 10.1).
 *
 * Для length<=PERMUTATION_LIMIT (5) перебираем все 120 перестановок — быстро.
 * Для length>PERMUTATION_LIMIT возвращаем только исходный порядок (24 → 120 → 720
 * → 5040 факториал растёт слишком быстро, и более 5 услуг в групповой брони
 * — редкий кейс, для которого UX «попробуйте поменять услуги местами» приемлем).
 */
const PERMUTATION_LIMIT = 5

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()]

  if (items.length > PERMUTATION_LIMIT) return [items.slice()]

  const result: T[][] = []

  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]

    for (const p of permutations(rest)) {
      result.push([items[i], ...p])
    }
  }

  return result
}

/**
 * Лучше ли новый кандидат предыдущего по этому стартовому времени?
 * 'preferred' побеждает 'any'; в равных условиях оставляем первое пришедшее
 * (первая перестановка = исходный порядок услуг → не меняем поведение зря).
 */
function isBetterCandidate(prev: GroupSlotEntry | undefined, candidate: GroupSlotEntry): boolean {
  if (!prev) return true

  return prev.match === 'any' && candidate.match === 'preferred'
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

  // Лучшее попадание на каждый стартовый слот, накопленное по всем перестановкам.
  const bestByStart = new Map<string, GroupSlotEntry>()

  for (const perm of permutations(items)) {
    const { preferredItems, anyItems, hasAnyPreferences } = buildPreferredAndAnyItems(perm)

    const anyOptions = findGroupSlots(
      anyItems, date, resourceSlotData, existingAppointments, settings, branchSchedule,
    )

    if (anyOptions.length === 0) continue

    let preferredByStart: Map<string, GroupSlotOption> | null = null

    // Ключ слота — `startTime + isNextDay`, чтобы не было коллизии между
    // overnight-фазой D+1 (например, '00:00' с isNextDay=true) и теоретическим
    // '00:00' D (не достижимо при overnight=22:00→04:00, но защищает от
    // будущих edge-кейсов).
    const slotKey = (opt: { startTime: string; startIsNextDay: boolean }): string =>
      `${opt.startIsNextDay ? '1' : '0'}-${opt.startTime}`

    if (hasAnyPreferences) {
      const preferredOptions = findGroupSlots(
        preferredItems, date, resourceSlotData, existingAppointments, settings, branchSchedule,
      )

      preferredByStart = new Map<string, GroupSlotOption>()
      for (const opt of preferredOptions) preferredByStart.set(slotKey(opt), opt)
    }

    for (const opt of anyOptions) {
      const key = slotKey(opt)
      const pref = preferredByStart?.get(key) ?? null
      const match: GroupSlotMatch = !hasAnyPreferences || pref ? 'preferred' : 'any'
      const candidate: GroupSlotEntry = pref
        ? { ...pref, match }
        : { ...opt, match }

      if (isBetterCandidate(bestByStart.get(key), candidate)) {
        bestByStart.set(key, candidate)
      }
    }
  }

  // Сортировка хронологическая: сначала слоты текущего дня (D) по времени,
  // потом фаза D+1 (overnight). Без учёта isNextDay '00:00' уехало бы в начало.
  const entries = Array.from(bestByStart.values()).sort((a, b) => {
    if (a.startIsNextDay !== b.startIsNextDay) return a.startIsNextDay ? 1 : -1
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  })

  return { type: 'slots', entries }
}

/**
 * Лёгкая проверка «есть ли в этой дате хоть один зелёный или жёлтый слот».
 * Используется для подсветки кнопок-дней в стрипе (зелёная точка / жёлтая / пусто).
 *
 * Возвращает 'preferred' если есть хотя бы один зелёный слот, 'any' если только
 * жёлтые, null если ничего нет (или общая длительность > рабочего дня).
 *
 * Не вызывает findGroupSlotsWithFallback напрямую: тот всегда обходит ВСЕ
 * перестановки чтобы построить полный список слотов. Здесь нам достаточно
 * первого preferred-попадания → выходим из перебора как только нашли его.
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
  const totalDuration = items.reduce((sum, item) => sum + item.duration, 0)

  if (totalDuration > workingDayMinutes) return null

  let foundAny = false

  for (const perm of permutations(items)) {
    const { preferredItems, anyItems, hasAnyPreferences } = buildPreferredAndAnyItems(perm)

    const anyOptions = findGroupSlots(
      anyItems, date, resourceSlotData, existingAppointments, settings, branchSchedule,
    )

    if (anyOptions.length === 0) continue

    foundAny = true

    if (!hasAnyPreferences) return 'preferred'

    const preferredOptions = findGroupSlots(
      preferredItems, date, resourceSlotData, existingAppointments, settings, branchSchedule,
    )

    if (preferredOptions.length > 0) return 'preferred'
  }

  return foundAny ? 'any' : null
}

// ─── Helpers для UI слот-чипсов (admin SlotChipGrid + storefront ApptGroupSlots) ─

export type SlotChipTone = 'success' | 'warning' | 'default'

/**
 * Цветовая семантика чипса по типу матча в slot engine:
 *   preferred → success (зелёный) — мастера-предпочтения свободны
 *   any       → warning (жёлтый)  — пришлось взять замену
 *   default   — fallback, в обычном flow не используется
 */
export const computeSlotTone = (entry: Pick<GroupSlotEntry, 'match'>): SlotChipTone => {
  if (entry.match === 'preferred') return 'success'
  if (entry.match === 'any') return 'warning'
  return 'default'
}

/**
 * Группирует записи по часу старта для рендера сетки 11:00 / 11:30 в одной
 * строке. Любой объект с полем startTime в формате "HH:MM" подойдёт — это
 * чисто UI-группировка, не зависит от GroupSlotEntry.
 */
export const groupSlotsByHour = <T extends { startTime: string }>(entries: readonly T[]): Map<number, T[]> => {
  const map = new Map<number, T[]>()

  for (const e of entries) {
    const h = parseInt(e.startTime.split(':')[0]!, 10)

    if (Number.isNaN(h)) continue
    const arr = map.get(h)

    if (arr) arr.push(e)
    else map.set(h, [e])
  }
  return map
}
