import { getTenantDb } from '../../utils/tenantDb'
import {
  createRateLimiter, todayInTz, DEFAULT_TIMEZONE,
  getGroupDateAvailability,
  localDateTimeToUtcIso, addDaysToDateStr, utcIsoToLocalDateTime,
  DEFAULT_WORKING_DAY_MINUTES,
} from '@fastio/shared'
import type {
  ResourceSlotData,
  AppointmentInterval,
  WorkingHoursSchedule,
  GroupSlotMatch,
} from '@fastio/shared'

const rateLimiter = createRateLimiter(120, 60_000)

const sliceTime = (v: unknown): string | null =>
  typeof v === 'string' ? v.slice(0, 5) : null

type WeekResponse = Array<{ date: string; match: GroupSlotMatch | null }>

/**
 * Batch-вариант: для списка дат возвращает 'preferred' / 'any' / null
 * (зелёная точка / жёлтая / пусто) для подсветки кнопок-дней в стрипе.
 *
 * Делает один запрос к статическим данным (ресурсы, расписания, шаблоны)
 * и батч-запросы к per-date данным (date-overrides, appointments) на весь
 * диапазон. Затем для каждой даты собирает срез и считает доступность.
 */
export default defineEventHandler(async (event): Promise<WeekResponse> => {
  const db = getTenantDb(event)

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const query = getQuery(event)
  const datesRaw = query.dates as string | undefined
  const branchId = query.branchId as string | undefined
  const itemsRaw = query.items as string | undefined

  if (!datesRaw) {
    throw createError({ statusCode: 400, message: 'Параметр dates обязателен (YYYY-MM-DD,YYYY-MM-DD,...)' })
  }
  const dates = datesRaw.split(',').map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s))
  if (dates.length === 0 || dates.length > 14) {
    throw createError({ statusCode: 400, message: 'dates должен содержать от 1 до 14 валидных дат' })
  }

  if (!itemsRaw) {
    throw createError({ statusCode: 400, message: 'Параметр items обязателен' })
  }

  type RawItem = { serviceId: string; preferredResourceId?: string }
  let parsedItems: RawItem[]
  try {
    parsedItems = JSON.parse(itemsRaw)
    if (!Array.isArray(parsedItems)) {
      throw new Error('items must be an array')
    }
    for (const item of parsedItems) {
      if (!item.serviceId || typeof item.serviceId !== 'string') {
        throw new Error('each item must have serviceId')
      }
    }
  } catch {
    throw createError({ statusCode: 400, message: 'Параметр items содержит некорректный JSON' })
  }

  // Пустая корзина — возвращаем нули для всех дат, без обращения в БД.
  if (parsedItems.length === 0) {
    return dates.map((d) => ({ date: d, match: null }))
  }

  const { data: tenantData } = await db
    .from('tenants')
    .select('modules, timezone, working_hours_schedule')
    .single()

  if (!tenantData?.modules?.services) {
    throw createError({ statusCode: 400, message: 'Онлайн-запись недоступна' })
  }

  const tz = (tenantData.timezone as string) ?? DEFAULT_TIMEZONE
  const tenantSchedule = (tenantData.working_hours_schedule as WorkingHoursSchedule | null) ?? null
  const todayStr = todayInTz(tz)

  const { data: settingsData } = await db
    .from('appointment_settings')
    .select('slot_step_minutes, booking_horizon_days')
    .maybeSingle()

  const slotStep = (settingsData?.slot_step_minutes as number) ?? 30
  const horizon = (settingsData?.booking_horizon_days as number) ?? 30

  const maxDate = addDaysToDateStr(todayStr, horizon)

  // Отбрасываем даты вне горизонта/прошедшие — для них null
  const validDates = dates.filter(d => d >= todayStr && d <= maxDate)
  const validSet = new Set(validDates)

  if (validDates.length === 0) {
    return dates.map(date => ({ date, match: null }))
  }

  const minDate = validDates.reduce((m, d) => (d < m ? d : m), validDates[0])
  const maxDateInRange = validDates.reduce((m, d) => (d > m ? d : m), validDates[0])

  const serviceIds = [...new Set(parsedItems.map((i) => i.serviceId))]

  const { data: servicesData } = await db
    .from('services')
    .select('id, duration, is_bookable, category_id')
    .in('id', serviceIds)

  const serviceById = new Map<string, { duration: number; categoryId: string | null }>(
    (servicesData ?? []).map((row) => [
      row.id as string,
      { duration: row.duration as number, categoryId: row.category_id as string | null },
    ]),
  )

  for (const item of parsedItems) {
    const svc = serviceById.get(item.serviceId)
    if (!svc || !svc.duration) {
      throw createError({ statusCode: 400, message: `Услуга ${item.serviceId} недоступна для записи` })
    }
  }

  const categoryIds = [...new Set(
    Array.from(serviceById.values()).map((s) => s.categoryId).filter((id): id is string => id !== null),
  )]

  // safe: serviceIds are validated against tenantId in the services query above;
  // categoryIds are derived from those tenant-validated service rows
  const [{ data: explicitResourcesData }, { data: categoryResourcesData }] = await Promise.all([
    db.junction('service_resources').select('service_id, resource_id').in('service_id', serviceIds),
    categoryIds.length > 0
      ? db.junction('resource_categories').select('category_id, resource_id').in('category_id', categoryIds)
      : Promise.resolve({ data: [] as Array<{ category_id: string; resource_id: string }> }),
  ])

  const resourceIdsByService = new Map<string, Set<string>>()
  for (const id of serviceIds) resourceIdsByService.set(id, new Set())

  for (const row of (explicitResourcesData ?? []) as Array<{ service_id: string; resource_id: string }>) {
    resourceIdsByService.get(row.service_id)?.add(row.resource_id)
  }

  for (const row of (categoryResourcesData ?? []) as Array<{ category_id: string; resource_id: string }>) {
    for (const id of serviceIds) {
      const svc = serviceById.get(id)
      if (svc?.categoryId === row.category_id) {
        resourceIdsByService.get(id)?.add(row.resource_id)
      }
    }
  }

  const allResourceIds = [...new Set(
    Array.from(resourceIdsByService.values()).flatMap((s) => Array.from(s)),
  )]

  let activeResourceIds: string[] = []
  const capacityById = new Map<string, number>()
  const shiftAnchor = new Map<string, { templateId: string; cycleStartDate: string }>()
  const resourceNameById = new Map<string, string>()

  if (allResourceIds.length > 0) {
    const { data: resourcesData } = await db
      .from('resources')
      .select('id, name, capacity, is_active, applied_template_id, cycle_start_date')
      .in('id', allResourceIds)
      .eq('is_active', true)

    activeResourceIds = (resourcesData ?? []).map((r) => r.id as string)

    for (const r of (resourcesData ?? []) as Array<{
      id: string
      name: string
      capacity: number | null
      applied_template_id: string | null
      cycle_start_date: string | null
    }>) {
      capacityById.set(r.id, r.capacity ?? 1)
      resourceNameById.set(r.id, r.name)
      if (r.applied_template_id && r.cycle_start_date) {
        shiftAnchor.set(r.id, { templateId: r.applied_template_id, cycleStartDate: r.cycle_start_date })
      }
    }

    if (branchId && activeResourceIds.length) {
      const { data: branchLinks } = await db
        .junction('resource_branches')
        .select('resource_id, branch_id')
        .in('resource_id', activeResourceIds)

      const linksByResource = new Map<string, string[]>()
      for (const row of (branchLinks ?? []) as { resource_id: string; branch_id: string }[]) {
        const arr = linksByResource.get(row.resource_id) ?? []
        arr.push(row.branch_id)
        linksByResource.set(row.resource_id, arr)
      }
      activeResourceIds = activeResourceIds.filter((id) => {
        const links = linksByResource.get(id) ?? []
        return links.length === 0 || links.includes(branchId)
      })
    }
  }

  const shiftTemplateIds = [...new Set(Array.from(shiftAnchor.values()).map((a) => a.templateId))]
  const [shiftTemplatesRes, shiftSlotsRes] = await Promise.all([
    shiftTemplateIds.length
      ? db.junction('schedule_templates').select('id, cycle_length').in('id', shiftTemplateIds)
      : Promise.resolve({ data: [] as Array<{ id: string; cycle_length: number }> }),
    shiftTemplateIds.length
      ? db.junction('schedule_template_slots').select('template_id, day_index, slot_time').in('template_id', shiftTemplateIds)
      : Promise.resolve({ data: [] as Array<{ template_id: string; day_index: number; slot_time: string }> }),
  ])

  const shiftCycleLengthById = new Map<string, number>(
    ((shiftTemplatesRes.data ?? []) as Array<{ id: string; cycle_length: number }>).map((t) => [t.id, t.cycle_length]),
  )
  const shiftSlotsByTemplate = new Map<string, Record<number, string[]>>()
  for (const row of (shiftSlotsRes.data ?? []) as Array<{ template_id: string; day_index: number; slot_time: string }>) {
    const map = shiftSlotsByTemplate.get(row.template_id) ?? {}
    const arr = map[row.day_index] ?? []
    arr.push((row.slot_time as string).slice(0, 5))
    map[row.day_index] = arr
    shiftSlotsByTemplate.set(row.template_id, map)
  }
  for (const [, byDay] of shiftSlotsByTemplate) {
    for (const k of Object.keys(byDay)) byDay[Number(k)].sort()
  }

  // Per-date данные на весь диапазон сразу
  const result: WeekResponse = dates.map(date => ({ date, match: null }))

  if (activeResourceIds.length === 0) return result

  const rangeStart = localDateTimeToUtcIso(minDate, '00:00', tz)
  const rangeEnd = localDateTimeToUtcIso(addDaysToDateStr(maxDateInRange, 1), '00:00', tz)

  const [
    schedulesData,
    disabledData,
    overridesData,
    dateDisabledData,
    appointmentsData,
    resourceBranchData,
  ] = await Promise.all([
    db.junction('resource_schedules').select('*').in('resource_id', activeResourceIds),
    db.junction('resource_disabled_slots').select('*').in('resource_id', activeResourceIds),
    db.junction('resource_date_overrides').select('*').in('resource_id', activeResourceIds).in('date', validDates),
    db.junction('resource_date_disabled_slots').select('*').in('resource_id', activeResourceIds).in('date', validDates),
    db.from('appointments')
      .select('resource_id, starts_at, ends_at, actual_ends_at')
      .in('resource_id', activeResourceIds)
      .gte('starts_at', rangeStart)
      .lt('starts_at', rangeEnd)
      .not('status', 'eq', 'cancelled'),
    db.junction('resource_branches').select('resource_id, branch_id').in('resource_id', activeResourceIds),
  ])

  const resourceBranchIds = [...new Set(((resourceBranchData.data ?? []) as { branch_id: string }[]).map((r) => r.branch_id))]
  const { data: branchSchedRows } = resourceBranchIds.length
    ? await db.raw.from('branches').select('id, working_hours_schedule').in('id', resourceBranchIds)
    : { data: [] as { id: string; working_hours_schedule: WorkingHoursSchedule | null }[] }

  const branchScheduleById = new Map<string, WorkingHoursSchedule | null>(
    ((branchSchedRows ?? []) as { id: string; working_hours_schedule: WorkingHoursSchedule | null }[])
      .map((b) => [b.id, b.working_hours_schedule ?? tenantSchedule]),
  )
  const branchByResource = new Map<string, string>()
  for (const row of (resourceBranchData.data ?? []) as { resource_id: string; branch_id: string }[]) {
    if (!branchByResource.has(row.resource_id)) branchByResource.set(row.resource_id, row.branch_id)
  }

  // Working day minutes — для проверки request_only
  let workingDayMinutes = DEFAULT_WORKING_DAY_MINUTES
  let branchSchedule: WorkingHoursSchedule | null = tenantSchedule
  if (branchId) {
    const sched = branchScheduleById.get(branchId)
    if (sched !== undefined) branchSchedule = sched ?? tenantSchedule
    if (branchSchedule) {
      // Берём максимальное окно за неделю (грубая верхняя оценка для request_only)
      const dayKeys = ['1', '2', '3', '4', '5', '6', '7']
      let maxMin = 0
      for (const k of dayKeys) {
        const day = branchSchedule.days[k] ?? branchSchedule.default
        if (day.dayOff || !day.open || !day.close) continue
        const openMin = Number(day.open.split(':')[0]) * 60 + Number(day.open.split(':')[1])
        const closeMin = Number(day.close.split(':')[0]) * 60 + Number(day.close.split(':')[1])
        if (closeMin - openMin > maxMin) maxMin = closeMin - openMin
      }
      if (maxMin > 0) workingDayMinutes = maxMin
    }
  }

  // Группируем per-date данные по дате+ресурсу
  type RawRow = Record<string, unknown> & { date: string; resource_id: string }
  const overridesByDateResource = new Map<string, RawRow[]>()
  for (const row of (overridesData.data ?? []) as RawRow[]) {
    const key = `${row.date}|${row.resource_id}`
    const arr = overridesByDateResource.get(key) ?? []
    arr.push(row)
    overridesByDateResource.set(key, arr)
  }
  const dateDisabledByDateResource = new Map<string, RawRow[]>()
  for (const row of (dateDisabledData.data ?? []) as RawRow[]) {
    const key = `${row.date}|${row.resource_id}`
    const arr = dateDisabledByDateResource.get(key) ?? []
    arr.push(row)
    dateDisabledByDateResource.set(key, arr)
  }

  const appointmentsByResourceAndDate = new Map<string, AppointmentInterval[]>()
  for (const a of (appointmentsData.data ?? []) as Array<{
    resource_id: string
    starts_at: string
    ends_at: string
    actual_ends_at: string | null
  }>) {
    // Дата старта в TZ тенанта, иначе записи возле полуночи (UTC) попадают
    // не в тот локальный день и слот считается «свободным».
    const { dateStr } = utcIsoToLocalDateTime(a.starts_at, tz)
    const key = `${dateStr}|${a.resource_id}`
    const arr = appointmentsByResourceAndDate.get(key) ?? []
    arr.push({
      startsAt: a.starts_at,
      endsAt: a.actual_ends_at ?? a.ends_at,
    })
    appointmentsByResourceAndDate.set(key, arr)
  }

  // Считаем для каждой валидной даты
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]
    if (!validSet.has(date)) continue

    const resourceSlotData = new Map<string, ResourceSlotData>()
    const existingAppointments = new Map<string, AppointmentInterval[]>()

    for (const rid of activeResourceIds) {
      const data: ResourceSlotData = {
        schedules: (schedulesData.data ?? [])
          .filter((s) => s.resource_id === rid)
          .map((s) => ({
            id: s.id as string,
            resourceId: s.resource_id as string,
            dayOfWeek: s.day_of_week as number,
            isWorking: s.is_working as boolean,
            openTime: sliceTime(s.open_time),
            closeTime: sliceTime(s.close_time),
          })),
        disabledSlots: (disabledData.data ?? [])
          .filter((s) => s.resource_id === rid)
          .map((s) => ({
            id: s.id as string,
            resourceId: s.resource_id as string,
            dayOfWeek: s.day_of_week as number,
            slotTime: (s.slot_time as string).slice(0, 5),
          })),
        dateOverrides: (overridesByDateResource.get(`${date}|${rid}`) ?? [])
          .map((s) => ({
            id: s.id as string,
            resourceId: rid,
            date,
            isWorking: s.is_working as boolean,
            openTime: sliceTime(s.open_time),
            closeTime: sliceTime(s.close_time),
          })),
        dateDisabledSlots: (dateDisabledByDateResource.get(`${date}|${rid}`) ?? [])
          .map((s) => ({
            id: s.id as string,
            resourceId: rid,
            date,
            slotTime: (s.slot_time as string).slice(0, 5),
          })),
        branchSchedule: (() => {
          const bid = branchByResource.get(rid)
          if (bid) return branchScheduleById.get(bid) ?? tenantSchedule
          return tenantSchedule
        })(),
        shiftCycle: (() => {
          const anchor = shiftAnchor.get(rid)
          if (!anchor) return null
          const cycleLength = shiftCycleLengthById.get(anchor.templateId)
          const slotsByDayIndex = shiftSlotsByTemplate.get(anchor.templateId)
          if (!cycleLength || !slotsByDayIndex) return null
          return { cycleStartDate: anchor.cycleStartDate, cycleLength, slotsByDayIndex }
        })(),
      }
      resourceSlotData.set(rid, data)
      existingAppointments.set(rid, appointmentsByResourceAndDate.get(`${date}|${rid}`) ?? [])
    }

    const groupItems = parsedItems.map((rawItem) => {
      const allIds = Array.from(resourceIdsByService.get(rawItem.serviceId) ?? [])
        .filter((id) => activeResourceIds.includes(id))
      const svc = serviceById.get(rawItem.serviceId)!
      const namesMap = new Map<string, string>()
      for (const id of allIds) namesMap.set(id, resourceNameById.get(id) ?? id)
      return {
        serviceId: rawItem.serviceId,
        duration: svc.duration,
        allResourceIds: allIds,
        preferredResourceId: rawItem.preferredResourceId ?? null,
        resourceNames: namesMap,
      }
    })

    result[i].match = getGroupDateAvailability(
      groupItems,
      date,
      resourceSlotData,
      existingAppointments,
      { slotStep, timezone: tz },
      workingDayMinutes,
      branchSchedule,
    )
  }

  return result
})
