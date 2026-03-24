import { getServerSupabase } from '../../utils/supabase'
import { createRateLimiter } from '../../utils/rateLimit'
import type { WorkingHoursSchedule } from '@fastio/shared'

const rateLimiter = createRateLimiter(30, 60_000)

function getIsoDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const js = d.getDay()
  return String(js === 0 ? 7 : js)
}

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
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, message: 'Параметр date обязателен (YYYY-MM-DD)' })
  }

  const supabase = getServerSupabase()

  const [{ data: tenantData }, { data: settingsData }] = await Promise.all([
    supabase.from('tenants').select('modules, working_hours_schedule').eq('id', tenantId).single(),
    supabase.from('reservation_settings').select('slot_step, close_buffer_minutes, enabled').eq('tenant_id', tenantId).maybeSingle(),
  ])

  if (!tenantData?.modules?.reservations) {
    throw createError({ statusCode: 400, message: 'Бронирование недоступно' })
  }
  if (settingsData && !settingsData.enabled) {
    throw createError({ statusCode: 400, message: 'Бронирование недоступно' })
  }

  const schedule = tenantData.working_hours_schedule as WorkingHoursSchedule | null
  const isoDay = getIsoDay(date)
  const dayHours = schedule ? (schedule.days[isoDay] ?? schedule.default) : { open: '10:00', close: '22:00', closeNextDay: false }

  const slotStep = (settingsData?.slot_step as number | null) ?? 30
  const closeBuffer = (settingsData?.close_buffer_minutes as number | null) ?? 60

  const times = generateSlots(dayHours.open, dayHours.close, slotStep, closeBuffer)

  return times.map((time) => ({ time, available: true }))
})
