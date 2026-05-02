import { getTenantDb } from '../../utils/tenantDb'
import { createRateLimiter, getIsoDayForDate, todayInTz, nowTimeInTz, generateTimeSlots, timeToMinutes, DEFAULT_TIMEZONE } from '@fastio/shared'
import type { WorkingHours, WorkingHoursSchedule } from '@fastio/shared'

const rateLimiter = createRateLimiter(30, 60_000)

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const query = getQuery(event)
  const date = query.date as string | undefined
  const branchId = query.branchId as string | undefined
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, message: 'Параметр date обязателен (YYYY-MM-DD)' })
  }

  const [{ data: tenantData }, { data: settingsData }, { data: branchData }] = await Promise.all([
    db.from('tenants').select('modules, working_hours_schedule, timezone').single(),
    db.from('reservation_settings').select('slot_step, close_buffer_minutes, enabled').maybeSingle(),
    branchId
      ? db.from('branches').select('working_hours_schedule').eq('id', branchId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!tenantData?.modules?.reservations) {
    throw createError({ statusCode: 400, message: 'Бронирование недоступно' })
  }
  if (settingsData && !settingsData.enabled) {
    throw createError({ statusCode: 400, message: 'Бронирование недоступно' })
  }

  const branchSchedule = branchData?.working_hours_schedule as WorkingHoursSchedule | null
  const schedule = branchSchedule ?? (tenantData.working_hours_schedule as WorkingHoursSchedule | null)
  const isoDay = getIsoDayForDate(date)
  const dayHours: WorkingHours = schedule ? (schedule.days[isoDay] ?? schedule.default) : { open: '10:00', close: '22:00' }

  if (dayHours.dayOff) return []

  const slotStep = (settingsData?.slot_step as number | null) ?? 30
  const closeBuffer = (settingsData?.close_buffer_minutes as number | null) ?? 60

  const slots = generateTimeSlots(dayHours.open, dayHours.close, slotStep, closeBuffer)

  const tenantTz = (tenantData.timezone as string) ?? DEFAULT_TIMEZONE
  const tenantToday = todayInTz(tenantTz)
  const tenantNowMin = date === tenantToday ? timeToMinutes(nowTimeInTz(tenantTz)) : null

  const filtered = slots.filter(({ timeStr, nextDay }) => {
    if (tenantNowMin === null) return true
    const slotMin = timeToMinutes(timeStr) + (nextDay ? 1440 : 0)
    return slotMin > tenantNowMin
  })

  return filtered.map(({ timeStr }) => ({ time: timeStr, available: true }))
})
