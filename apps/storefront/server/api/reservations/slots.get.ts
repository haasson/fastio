import { getServerSupabase } from '../../utils/supabase'
import { createRateLimiter } from '@fastio/shared'
import type { WorkingHours, WorkingHoursSchedule } from '@fastio/shared'
import { getIsoDayForDate, todayInTz, nowTimeInTz } from '@fastio/shared'

const rateLimiter = createRateLimiter(30, 60_000)

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function generateSlots(open: string, close: string, step: number, bufferMinutes: number): string[] {
  const openMin = toMinutes(open)
  const closeMin = toMinutes(close) + (toMinutes(close) <= toMinutes(open) ? 1440 : 0)
  const lastSlot = closeMin - bufferMinutes

  const slots: string[] = []
  let cur = openMin
  while (cur <= lastSlot) {
    slots.push(minutesToTime(cur))
    cur += step
  }
  return slots
}

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

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

  const supabase = getServerSupabase()

  const [{ data: tenantData }, { data: settingsData }, { data: branchData }] = await Promise.all([
    supabase.from('tenants').select('modules, working_hours_schedule, timezone').eq('id', tenantId).single(),
    supabase.from('reservation_settings').select('slot_step, close_buffer_minutes, enabled').eq('tenant_id', tenantId).maybeSingle(),
    branchId
      ? supabase.from('branches').select('working_hours_schedule').eq('id', branchId).eq('tenant_id', tenantId).maybeSingle()
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

  const times = generateSlots(dayHours.open, dayHours.close, slotStep, closeBuffer)

  const tenantTz = (tenantData.timezone as string) ?? 'Europe/Moscow'
  const tenantToday = todayInTz(tenantTz)
  const tenantNow = nowTimeInTz(tenantTz)

  const filteredTimes = date === tenantToday
    ? times.filter(t => {
        const isAfterMidnight = toMinutes(t) < toMinutes(dayHours.open)
        return isAfterMidnight || t > tenantNow
      })
    : times

  return filteredTimes.map((time) => ({ time, available: true }))
})
