import { getTenantDb } from '../../utils/tenantDb'
import { getClientIp } from '../../utils/clientIp'
import {
  createRateLimiter, todayInTz, DEFAULT_TIMEZONE, sliceTime,
  getResourceSlotsForDate, mergeResourceSlots, getBranchSlotsForDate,
  localDateTimeToUtcIso, addDaysToDateStr,
  DEFAULT_APPOINTMENT_SETTINGS,
  mapResourceUnavailability,
} from '@fastio/shared'
import type { ResourceSlotData, AppointmentInterval, WorkingHoursSchedule, ResourceUnavailability } from '@fastio/shared'

const rateLimiter = createRateLimiter(30, 60_000)

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const ip = getClientIp(event)
  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const query = getQuery(event)
  const date = query.date as string | undefined
  const serviceId = query.serviceId as string | undefined
  const resourceId = query.resourceId as string | undefined  // optional: конкретный исполнитель
  const branchId = query.branchId as string | undefined      // optional: фильтр по филиалу

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, message: 'Параметр date обязателен (YYYY-MM-DD)' })
  }
  if (!serviceId) {
    throw createError({ statusCode: 400, message: 'Параметр serviceId обязателен' })
  }

  const { data: tenantData } = await db
    .from('tenants')
    .select('modules, timezone')
    .single()

  if (!tenantData?.modules?.services) {
    throw createError({ statusCode: 400, message: 'Онлайн-запись недоступна' })
  }

  const tz = (tenantData.timezone as string) ?? DEFAULT_TIMEZONE
  const todayStr = todayInTz(tz)

  if (date < todayStr) {
    throw createError({ statusCode: 400, message: 'Нельзя выбрать прошедшую дату' })
  }

  const { data: settingsData } = await db
    .from('appointment_settings')
    .select('slot_step_minutes, booking_horizon_days')
    .maybeSingle()

  const slotStep = (settingsData?.slot_step_minutes as number | null) ?? DEFAULT_APPOINTMENT_SETTINGS.slotStepMinutes
  const horizon = (settingsData?.booking_horizon_days as number | null) ?? DEFAULT_APPOINTMENT_SETTINGS.bookingHorizonDays

  const maxDate = addDaysToDateStr(todayStr, horizon)
  if (date > maxDate) {
    throw createError({ statusCode: 400, message: 'Дата вне горизонта бронирования' })
  }

  const { data: serviceData } = await db
    .from('services')
    .select('duration, is_bookable, category_id')
    .eq('id', serviceId)
    .single()

  if (!serviceData?.is_bookable || !serviceData.duration) {
    throw createError({ statusCode: 400, message: 'Услуга недоступна для записи' })
  }

  const duration = serviceData.duration as number

  // Услуга недоступна в этом филиале (если service_branches не пуст и branchId не входит)
  if (branchId) {
    // safe: serviceId is validated against tenantId above
    const { data: svcBranches } = await db
      .junction('service_branches')
      .select('branch_id')
      .eq('service_id', serviceId)
    const list = (svcBranches ?? []).map((r) => r.branch_id as string)
    if (list.length > 0 && !list.includes(branchId)) return []
  }

  // ─── Эффективные ресурсы для услуги ───────────────────────
  // Объединяем явные (service_resources) и через категорию (resource_categories).
  // safe: serviceId and category_id are validated against tenantId in the services query above

  const [{ data: explicitData }, { data: categoryData }] = await Promise.all([
    db.junction('service_resources').select('resource_id').eq('service_id', serviceId),
    serviceData.category_id
      ? db.junction('resource_categories').select('resource_id').eq('category_id', serviceData.category_id as string)
      : Promise.resolve({ data: [] as { resource_id: string }[] }),
  ])

  const effectiveIds = new Set<string>([
    ...(explicitData ?? []).map((r) => r.resource_id as string),
    ...(categoryData ?? []).map((r) => r.resource_id as string),
  ])

  let activeResourceIds = Array.from(effectiveIds)

  // Фильтруем по ресурсу/филиалу
  if (activeResourceIds.length) {
    let resQuery = db
      .from('resources')
      .select('id, capacity, is_active, applied_template_id, cycle_start_date')
      .in('id', activeResourceIds)
      .eq('is_active', true)

    if (resourceId) resQuery = resQuery.eq('id', resourceId)

    const { data: resourcesData } = await resQuery
    activeResourceIds = (resourcesData ?? []).map((r) => r.id as string)

    const capacityById = new Map<string, number>(
      (resourcesData ?? []).map((r) => [r.id as string, (r.capacity as number) ?? 1]),
    )

    // Привязки к shift-шаблонам (для lazy-вычисления цикла без материализации).
    const shiftAnchor = new Map<string, { templateId: string; cycleStartDate: string }>()

    for (const r of (resourcesData ?? []) as Array<{ id: string; applied_template_id: string | null; cycle_start_date: string | null }>) {
      if (r.applied_template_id && r.cycle_start_date) {
        shiftAnchor.set(r.id, { templateId: r.applied_template_id, cycleStartDate: r.cycle_start_date })
      }
    }
    const shiftTemplateIds = Array.from(new Set(Array.from(shiftAnchor.values()).map((a) => a.templateId)))

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
        // пусто = ресурс работает во всех филиалах
        return links.length === 0 || links.includes(branchId)
      })
    }

    if (!activeResourceIds.length && !resourceId) {
      // Услуга у которой назначены ресурсы, но в этом филиале их нет — фолбек на филиал не делаем
      return []
    }

    if (activeResourceIds.length) {
      const dayStart = localDateTimeToUtcIso(date, '00:00', tz)
      const dayEnd = localDateTimeToUtcIso(addDaysToDateStr(date, 1), '00:00', tz)

      const [schedulesData, disabledData, overridesData, dateDisabledData, unavailabilityData, appointmentsData, resourceBranchData, shiftTemplatesData, shiftDaysData] = await Promise.all([
        db.junction('resource_schedules').select('*').in('resource_id', activeResourceIds),
        db.junction('resource_disabled_slots').select('*').in('resource_id', activeResourceIds),
        db.junction('resource_date_overrides').select('*').in('resource_id', activeResourceIds).eq('date', date),
        db.junction('resource_date_disabled_slots').select('*').in('resource_id', activeResourceIds).eq('date', date),
        db.from('resource_unavailability').select('*').in('resource_id', activeResourceIds)
          .lte('date_from', date).gte('date_to', date),
        db.from('appointments')
          .select('resource_id, starts_at, ends_at, actual_ends_at')
          .in('resource_id', activeResourceIds)
          .gte('starts_at', dayStart)
          .lt('starts_at', dayEnd)
          .not('status', 'eq', 'cancelled'),
        db.junction('resource_branches').select('resource_id, branch_id').in('resource_id', activeResourceIds),
        shiftTemplateIds.length
          ? db.junction('schedule_templates').select('id, cycle_length').in('id', shiftTemplateIds)
          : Promise.resolve({ data: [] as Array<{ id: string; cycle_length: number }> }),
        shiftTemplateIds.length
          ? db.junction('schedule_template_days').select('template_id, day_index, is_working, open_time, close_time').in('template_id', shiftTemplateIds)
          : Promise.resolve({ data: [] as Array<{ template_id: string; day_index: number; is_working: boolean; open_time: string | null; close_time: string | null }> }),
      ])

      const shiftCycleLengthById = new Map<string, number>(
        ((shiftTemplatesData.data ?? []) as Array<{ id: string; cycle_length: number }>).map((t) => [t.id, t.cycle_length]),
      )
      const shiftHoursByTemplate = new Map<string, Record<number, { openTime: string; closeTime: string } | null>>()
      for (const row of (shiftDaysData.data ?? []) as Array<{ template_id: string; day_index: number; is_working: boolean; open_time: string | null; close_time: string | null }>) {
        const map = shiftHoursByTemplate.get(row.template_id) ?? {}
        if (!row.is_working || !row.open_time || !row.close_time) {
          map[row.day_index] = null
        } else {
          map[row.day_index] = {
            openTime: (row.open_time as string).slice(0, 5),
            closeTime: (row.close_time as string).slice(0, 5),
          }
        }
        shiftHoursByTemplate.set(row.template_id, map)
      }

      // Для фоллбека "график не задан → как у филиала" грузим расписания всех связанных филиалов + tenant.
      const resourceBranchIds = Array.from(new Set(((resourceBranchData.data ?? []) as { branch_id: string }[]).map((r) => r.branch_id)))
      const [branchSchedRes, tenantSchedRes] = await Promise.all([
        resourceBranchIds.length
          ? db.raw.from('branches').select('id, working_hours_schedule').in('id', resourceBranchIds)
          : Promise.resolve({ data: [] as { id: string; working_hours_schedule: WorkingHoursSchedule | null }[] }),
        db.from('tenants').select('working_hours_schedule').maybeSingle(),
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

      // Pre-маппинг unavailability в Map<resourceId, ResourceUnavailability[]> —
      // в loop по ресурсам ниже переиспользуем как есть, без повторных filter+map.
      const unavailabilityByResource = new Map<string, ResourceUnavailability[]>()
      for (const row of (unavailabilityData.data ?? []) as Record<string, unknown>[]) {
        const u = mapResourceUnavailability(row)
        const arr = unavailabilityByResource.get(u.resourceId) ?? []
        arr.push(u)
        unavailabilityByResource.set(u.resourceId, arr)
      }

      const resourceDataMap = new Map<string, { data: ResourceSlotData; appointments: AppointmentInterval[]; capacity: number }>()

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
          unavailability: unavailabilityByResource.get(rid) ?? [],
          branchSchedule: (() => {
            const bid = branchByResource.get(rid)
            if (bid) return branchScheduleById.get(bid) ?? tenantSchedule
            return tenantSchedule
          })(),
          shiftCycle: (() => {
            const anchor = shiftAnchor.get(rid)
            if (!anchor) return null
            const cycleLength = shiftCycleLengthById.get(anchor.templateId)
            const hoursByDayIndex = shiftHoursByTemplate.get(anchor.templateId)
            if (!cycleLength || !hoursByDayIndex) return null
            return { cycleStartDate: anchor.cycleStartDate, cycleLength, hoursByDayIndex }
          })(),
        }

        const appts: AppointmentInterval[] = (appointmentsData.data ?? [])
          .filter((a) => a.resource_id === rid)
          .map((a) => ({
            startsAt: a.starts_at as string,
            endsAt: (a.actual_ends_at as string | null) ?? (a.ends_at as string),
          }))

        resourceDataMap.set(rid, {
          data,
          appointments: appts,
          capacity: capacityById.get(rid) ?? 1,
        })
      }

      if (resourceId) {
        // Явная защита: если запросили конкретный ресурс, но он не оказался в
        // активном наборе (отфильтрован RLS / филиалом / is_active=false) —
        // не падаем на activeResourceIds[0] из соседнего ресурса.
        const entry = resourceDataMap.get(resourceId)
        if (!entry) return []
        return getResourceSlotsForDate(date, entry.data, entry.appointments, duration, slotStep, tz, entry.capacity)
      }

      return mergeResourceSlots(date, Array.from(resourceDataMap.values()), duration, slotStep, tz)
    }
  }

  // ─── Услуга без исполнителя — слоты по графику филиала ───
  // Если задан конкретный resourceId — это ошибка фильтрации, выходим.
  if (resourceId) return []

  const branchQuery = db.from('branches').select('id, working_hours_schedule')
  const { data: branchesData } = branchId
    ? await branchQuery.eq('id', branchId)
    : await branchQuery

  if (!branchesData || !branchesData.length) return []

  // Берём первый матчинг — на сторфронте обычно фиксируем филиал перед слотами
  const branch = branchesData[0]
  let branchSchedule = (branch.working_hours_schedule as WorkingHoursSchedule | null) ?? null
  if (!branchSchedule) {
    const { data: t } = await db.from('tenants').select('working_hours_schedule').maybeSingle()
    branchSchedule = (t?.working_hours_schedule as WorkingHoursSchedule | null) ?? null
  }

  const dayStart = localDateTimeToUtcIso(date, '00:00', tz)
  const dayEnd = localDateTimeToUtcIso(addDaysToDateStr(date, 1), '00:00', tz)

  const { data: appointmentsData } = await db
    .from('appointments')
    .select('starts_at, ends_at, actual_ends_at')
    .eq('service_id', serviceId)
    .eq('branch_id', branch.id)
    .gte('starts_at', dayStart)
    .lt('starts_at', dayEnd)
    .not('status', 'eq', 'cancelled')

  const appts: AppointmentInterval[] = (appointmentsData ?? []).map((a) => ({
    startsAt: a.starts_at as string,
    endsAt: (a.actual_ends_at as string | null) ?? (a.ends_at as string),
  }))

  return getBranchSlotsForDate(date, branchSchedule, appts, duration, slotStep, tz, 1)
})
