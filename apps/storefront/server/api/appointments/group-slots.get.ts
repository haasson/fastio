import { getServerSupabase } from '../../utils/supabase'
import {
  createRateLimiter, todayInTz, DEFAULT_TIMEZONE,
  findGroupSlotsWithFallback,
  getBranchHoursForDow, timeToMinutes,
  localDateTimeToUtcIso, addDaysToDateStr,
  DEFAULT_WORKING_DAY_MINUTES,
} from '@fastio/shared'
import type { ResourceSlotData, AppointmentInterval, WorkingHoursSchedule, GroupSlotsResult } from '@fastio/shared'

const rateLimiter = createRateLimiter(30, 60_000)

const sliceTime = (v: unknown): string | null =>
  typeof v === 'string' ? v.slice(0, 5) : null

export default defineEventHandler(async (event): Promise<GroupSlotsResult> => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const query = getQuery(event)
  const date = query.date as string | undefined
  const branchId = query.branchId as string | undefined
  const itemsRaw = query.items as string | undefined

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, message: 'Параметр date обязателен (YYYY-MM-DD)' })
  }

  if (!itemsRaw) {
    throw createError({ statusCode: 400, message: 'Параметр items обязателен' })
  }

  type RawItem = { serviceId: string; preferredResourceId?: string }
  let parsedItems: RawItem[]
  try {
    parsedItems = JSON.parse(itemsRaw)
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      throw new Error('items must be a non-empty array')
    }
    for (const item of parsedItems) {
      if (!item.serviceId || typeof item.serviceId !== 'string') {
        throw new Error('each item must have serviceId')
      }
    }
  } catch {
    throw createError({ statusCode: 400, message: 'Параметр items содержит некорректный JSON' })
  }

  const supabase = getServerSupabase()

  const { data: tenantData } = await supabase
    .from('tenants')
    .select('modules, timezone')
    .eq('id', tenantId)
    .single()

  if (!tenantData?.modules?.services) {
    throw createError({ statusCode: 400, message: 'Онлайн-запись недоступна' })
  }

  const tz = (tenantData.timezone as string) ?? DEFAULT_TIMEZONE
  const todayStr = todayInTz(tz)

  if (date < todayStr) {
    throw createError({ statusCode: 400, message: 'Нельзя выбрать прошедшую дату' })
  }

  const { data: settingsData } = await supabase
    .from('appointment_settings')
    .select('slot_step_minutes, booking_horizon_days')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const slotStep = (settingsData?.slot_step_minutes as number) ?? 30
  const horizon = (settingsData?.booking_horizon_days as number) ?? 30

  const maxDate = addDaysToDateStr(todayStr, horizon)
  if (date > maxDate) {
    throw createError({ statusCode: 400, message: 'Дата вне горизонта бронирования' })
  }

  const serviceIds = [...new Set(parsedItems.map((i) => i.serviceId))]

  const { data: servicesData } = await supabase
    .from('services')
    .select('id, duration, is_bookable, category_id')
    .in('id', serviceIds)
    .eq('tenant_id', tenantId)

  const serviceById = new Map<string, { duration: number; categoryId: string | null }>(
    (servicesData ?? []).map((row) => [
      row.id as string,
      { duration: row.duration as number, categoryId: row.category_id as string | null },
    ]),
  )

  // Валидируем что все услуги доступны для записи
  for (const item of parsedItems) {
    const svc = serviceById.get(item.serviceId)
    if (!svc || !svc.duration) {
      throw createError({ statusCode: 400, message: `Услуга ${item.serviceId} недоступна для записи` })
    }
  }

  // Получаем ресурсы для каждой услуги (явные + через категорию)
  const categoryIds = [...new Set(
    Array.from(serviceById.values()).map((s) => s.categoryId).filter((id): id is string => id !== null),
  )]

  const [{ data: explicitResourcesData }, { data: categoryResourcesData }] = await Promise.all([
    supabase.from('service_resources').select('service_id, resource_id').in('service_id', serviceIds),
    categoryIds.length > 0
      ? supabase.from('resource_categories').select('category_id, resource_id').in('category_id', categoryIds)
      : Promise.resolve({ data: [] as Array<{ category_id: string; resource_id: string }> }),
  ])

  // Строим map: serviceId → Set<resourceId>
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

  // Все уникальные resourceIds
  const allResourceIds = [...new Set(
    Array.from(resourceIdsByService.values()).flatMap((s) => Array.from(s)),
  )]

  // Загружаем данные ресурсов (только активные)
  let activeResourceIds: string[] = []
  const capacityById = new Map<string, number>()
  const shiftAnchor = new Map<string, { templateId: string; cycleStartDate: string }>()
  const resourceNameById = new Map<string, string>()

  if (allResourceIds.length > 0) {
    const resQuery = supabase
      .from('resources')
      .select('id, name, capacity, is_active, applied_template_id, cycle_start_date')
      .in('id', allResourceIds)
      .eq('is_active', true)

    const { data: resourcesData } = await resQuery
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

    // Фильтрация по филиалу
    if (branchId && activeResourceIds.length) {
      const { data: branchLinks } = await supabase
        .from('resource_branches')
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

  // Загружаем shift-шаблоны
  const shiftTemplateIds = [...new Set(Array.from(shiftAnchor.values()).map((a) => a.templateId))]
  const [shiftTemplatesRes, shiftSlotsRes] = await Promise.all([
    shiftTemplateIds.length
      ? supabase.from('schedule_templates').select('id, cycle_length').in('id', shiftTemplateIds)
      : Promise.resolve({ data: [] as Array<{ id: string; cycle_length: number }> }),
    shiftTemplateIds.length
      ? supabase.from('schedule_template_slots').select('template_id, day_index, slot_time').in('template_id', shiftTemplateIds)
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

  // Загружаем графики и записи для активных ресурсов
  const resourceSlotData = new Map<string, ResourceSlotData>()
  const existingAppointments = new Map<string, AppointmentInterval[]>()

  if (activeResourceIds.length > 0) {
    const dayStart = localDateTimeToUtcIso(date, '00:00', tz)
    const dayEnd = localDateTimeToUtcIso(addDaysToDateStr(date, 1), '00:00', tz)

    const [
      schedulesData,
      disabledData,
      overridesData,
      dateDisabledData,
      appointmentsData,
      resourceBranchData,
    ] = await Promise.all([
      supabase.from('resource_schedules').select('*').in('resource_id', activeResourceIds),
      supabase.from('resource_disabled_slots').select('*').in('resource_id', activeResourceIds),
      supabase.from('resource_date_overrides').select('*').in('resource_id', activeResourceIds).eq('date', date),
      supabase.from('resource_date_disabled_slots').select('*').in('resource_id', activeResourceIds).eq('date', date),
      supabase.from('appointments')
        .select('resource_id, starts_at, ends_at, actual_ends_at')
        .in('resource_id', activeResourceIds)
        .gte('starts_at', dayStart)
        .lt('starts_at', dayEnd)
        .not('status', 'eq', 'cancelled'),
      supabase.from('resource_branches').select('resource_id, branch_id').in('resource_id', activeResourceIds),
    ])

    // Получаем расписания связанных филиалов для фоллбека
    const resourceBranchIds = [...new Set(((resourceBranchData.data ?? []) as { branch_id: string }[]).map((r) => r.branch_id))]
    const [branchSchedRes, tenantSchedRes] = await Promise.all([
      resourceBranchIds.length
        ? supabase.from('branches').select('id, working_hours_schedule').in('id', resourceBranchIds)
        : Promise.resolve({ data: [] as { id: string; working_hours_schedule: WorkingHoursSchedule | null }[] }),
      supabase.from('tenants').select('working_hours_schedule').eq('id', tenantId).maybeSingle(),
    ])

    const tenantSchedule = (tenantSchedRes.data?.working_hours_schedule as WorkingHoursSchedule | null) ?? null
    const branchScheduleById = new Map<string, WorkingHoursSchedule | null>(
      ((branchSchedRes.data ?? []) as { id: string; working_hours_schedule: WorkingHoursSchedule | null }[])
        .map((b) => [b.id, b.working_hours_schedule ?? tenantSchedule]),
    )
    const branchByResource = new Map<string, string>()
    for (const row of (resourceBranchData.data ?? []) as { resource_id: string; branch_id: string }[]) {
      if (!branchByResource.has(row.resource_id)) branchByResource.set(row.resource_id, row.branch_id)
    }

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
        dateOverrides: (overridesData.data ?? [])
          .filter((s) => s.resource_id === rid)
          .map((s) => ({
            id: s.id as string,
            resourceId: s.resource_id as string,
            date: s.date as string,
            isWorking: s.is_working as boolean,
            openTime: sliceTime(s.open_time),
            closeTime: sliceTime(s.close_time),
          })),
        dateDisabledSlots: (dateDisabledData.data ?? [])
          .filter((s) => s.resource_id === rid)
          .map((s) => ({
            id: s.id as string,
            resourceId: s.resource_id as string,
            date: s.date as string,
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

      const appts: AppointmentInterval[] = (appointmentsData.data ?? [])
        .filter((a) => a.resource_id === rid)
        .map((a) => ({
          startsAt: a.starts_at as string,
          endsAt: (a.actual_ends_at as string | null) ?? (a.ends_at as string),
        }))

      existingAppointments.set(rid, appts)
    }
  }

  // Загружаем branchSchedule для передачи в findGroupSlotsWithFallback
  let branchSchedule: WorkingHoursSchedule | null = null
  if (branchId) {
    const { data: branchData } = await supabase
      .from('branches')
      .select('working_hours_schedule')
      .eq('id', branchId)
      .maybeSingle()
    branchSchedule = (branchData?.working_hours_schedule as WorkingHoursSchedule | null) ?? null
  }
  if (!branchSchedule) {
    const { data: tenantSched } = await supabase
      .from('tenants')
      .select('working_hours_schedule')
      .eq('id', tenantId)
      .maybeSingle()
    branchSchedule = (tenantSched?.working_hours_schedule as WorkingHoursSchedule | null) ?? null
  }

  // Считаем workingDayMinutes из расписания на эту дату; ISO-ключи в WorkingHoursSchedule
  // (1..7), потому используем общий хелпер getBranchHoursForDow с dow 0=Sun..6=Sat.
  let workingDayMinutes = DEFAULT_WORKING_DAY_MINUTES
  if (branchSchedule) {
    const dow = new Date(date + 'T12:00:00').getDay()
    const hours = getBranchHoursForDow(branchSchedule, dow)
    if (hours) {
      const openMin = timeToMinutes(hours.open)
      const closeMin = timeToMinutes(hours.close)
      if (closeMin > openMin) workingDayMinutes = closeMin - openMin
    }
  }

  // Строим items для findGroupSlotsWithFallback
  const groupItems = parsedItems.map((rawItem) => {
    const allResourceIds = Array.from(resourceIdsByService.get(rawItem.serviceId) ?? [])
      .filter((id) => activeResourceIds.includes(id))
    const svc = serviceById.get(rawItem.serviceId)!
    const namesMap = new Map<string, string>()
    for (const id of allResourceIds) {
      namesMap.set(id, resourceNameById.get(id) ?? id)
    }
    return {
      serviceId: rawItem.serviceId,
      duration: svc.duration,
      allResourceIds,
      preferredResourceId: rawItem.preferredResourceId ?? null,
      resourceNames: namesMap,
    }
  })

  return findGroupSlotsWithFallback(
    groupItems,
    date,
    resourceSlotData,
    existingAppointments,
    { slotStep, timezone: tz },
    workingDayMinutes,
    branchSchedule,
  )
})
