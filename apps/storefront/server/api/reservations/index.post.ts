import { randomUUID } from 'node:crypto'
import { getAuthSupabase, resolveMaxGuests } from '../../utils/supabase'
import { getTenantDb } from '../../utils/tenantDb'
import { getClientIp } from '../../utils/clientIp'
import { reportError } from '~/shared/utils/reportError'
import { createRateLimiter, todayInTz, nowTimeInTz, addDaysToDateStr, getIsoDayForDate, generateTimeSlots, timeToMinutes, DEFAULT_TIMEZONE } from '@fastio/shared'
import type { WorkingHours, WorkingHoursSchedule } from '@fastio/shared'

const rateLimiter = createRateLimiter(5, 60_000)

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const { tenantId } = db

  const ip = getClientIp(event)

  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const body = await readBody(event)

  // Basic validation
  if (!body.guestName?.trim()) {
    throw createError({ statusCode: 400, message: 'Укажите имя' })
  }
  if (!body.guestPhone?.trim()) {
    throw createError({ statusCode: 400, message: 'Укажите телефон' })
  }
  const phoneDigits = body.guestPhone.trim().replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 12) {
    throw createError({ statusCode: 400, message: 'Некорректный номер телефона' })
  }
  if (!body.reservedDate || !body.reservedTime) {
    throw createError({ statusCode: 400, message: 'Укажите дату и время' })
  }
  if (!Number.isInteger(body.guestCount) || body.guestCount < 1) {
    throw createError({ statusCode: 400, message: 'Укажите количество гостей' })
  }

  // Check module enabled
  const { data: tenantData } = await db
    .from('tenants')
    .select('modules, timezone, working_hours_schedule')
    .single()

  if (!tenantData?.modules?.reservations) {
    throw createError({ statusCode: 400, message: 'Бронирование недоступно' })
  }

  // Get and validate settings
  const { data: settings } = await db
    .from('reservation_settings')
    .select('*')
    .maybeSingle()

  if (settings && !settings.enabled) {
    throw createError({ statusCode: 400, message: 'Бронирование недоступно' })
  }

  // Branch working hours override (если бронь по конкретному филиалу)
  const branchId = body.branchId || null
  const { data: branchData } = branchId
    ? await db.from('branches').select('working_hours_schedule').eq('id', branchId).maybeSingle()
    : { data: null }

  const minGuests = settings?.min_guests ?? 1
  const maxAdvanceDays = settings?.max_advance_days ?? 30
  const autoConfirm = settings?.auto_confirm ?? false
  const maxGuests = await resolveMaxGuests(db.raw, tenantId, settings ?? {})

  // Validate guest count
  if (body.guestCount < minGuests || body.guestCount > maxGuests) {
    throw createError({
      statusCode: 400,
      message: `Количество гостей: от ${minGuests} до ${maxGuests}`,
    })
  }

  // Validate date range
  const tenantTz = (tenantData.timezone as string) ?? DEFAULT_TIMEZONE
  const todayStr = todayInTz(tenantTz)

  if (body.reservedDate < todayStr) {
    throw createError({ statusCode: 400, message: 'Нельзя бронировать на прошедшую дату' })
  }

  const maxDateStr = addDaysToDateStr(todayStr, maxAdvanceDays)

  if (body.reservedDate > maxDateStr) {
    throw createError({ statusCode: 400, message: `Бронирование доступно не позднее чем за ${maxAdvanceDays} дней` })
  }

  // ─── Server-side slot validation ─────────────────────────────────────────
  // Сверяем reservedTime со списком сгенерированных слотов — иначе через curl
  // можно создать бронь на 03:00 (никогда не открыто) или любое другое время
  // вне расписания. Capacity не проверяем: бронируется стол, не «N мест»,
  // и заявки без table_id распределяет админ через ReservationTablePicker.
  const branchSchedule = (branchData?.working_hours_schedule as WorkingHoursSchedule | null) ?? null
  const schedule = branchSchedule ?? (tenantData.working_hours_schedule as WorkingHoursSchedule | null)
  const isoDay = getIsoDayForDate(body.reservedDate)
  const dayHours: WorkingHours = schedule
    ? (schedule.days[isoDay] ?? schedule.default)
    : { open: '10:00', close: '22:00' }

  if (dayHours.dayOff) {
    throw createError({ statusCode: 400, message: 'В этот день бронирование недоступно' })
  }

  const slotStep = (settings?.slot_step as number | null) ?? 30
  const closeBuffer = (settings?.close_buffer_minutes as number | null) ?? 60
  const slots = generateTimeSlots(dayHours.open, dayHours.close, slotStep, closeBuffer)

  // На «сегодня» дополнительно отсекаем прошедшие слоты — иначе через curl
  // можно забронировать утренний слот вечером (defense-in-depth, клиент уже фильтрует).
  const tenantNowMin = body.reservedDate === todayStr ? timeToMinutes(nowTimeInTz(tenantTz)) : null
  const availableSlots = slots.filter(({ timeStr, nextDay }) => {
    if (tenantNowMin === null) return true
    const slotMin = timeToMinutes(timeStr) + (nextDay ? 1440 : 0)

    return slotMin > tenantNowMin
  })

  const normalizedTime = String(body.reservedTime).slice(0, 5)
  const pickedSlot = availableSlots.find(s => s.timeStr === normalizedTime)

  if (!pickedSlot) {
    throw createError({ statusCode: 400, message: 'Указанное время недоступно для бронирования' })
  }

  // Overnight-расписание (open=18:00, close=02:00): слот «01:00» относится к
  // СЛЕДУЮЩЕМУ календарному дню. Клиент шлёт исходную дату — сервер сдвигает.
  const reservedDate = pickedSlot.nextDay ? addDaysToDateStr(body.reservedDate, 1) : body.reservedDate

  // Try to identify authenticated customer.
  // Logic: разделяем «нет user / невалидный JWT» (by-design guest-fallback,
  // не шумим в Sentry) от «Supabase upstream-ошибка» (реальный инцидент,
  // логируем). Без этого Supabase-инцидент маскировался как guest и заказ
  // создавался под customerId=null молча.
  let customerId: string | null = null
  const authHeader = getRequestHeader(event, 'authorization')

  if (authHeader) {
    try {
      const authClient = getAuthSupabase(authHeader)
      const { data: { user }, error: userError } = await authClient.auth.getUser()

      // userError == invalid/expired JWT — нормальный guest-fallback.
      if (!userError && user) {
        const { data: customerData, error: customerError } = await db
          .from('customers')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (customerError) {
          // Реальная DB-ошибка — заказ создастся под customerId=null, но
          // мы хотя бы увидим инцидент в Sentry.
          reportError(customerError, { context: 'reservations.post:lookup-customer', userId: user.id })
        } else if (customerData) {
          customerId = customerData.id
        }
      }
    } catch (e) {
      // Инфра-ошибка (network / Supabase init / JWKS) — реально надо знать.
      reportError(e, { context: 'reservations.post:optional-auth' })
    }
  }

  const status = autoConfirm ? 'confirmed' : 'pending'

  // IDOR guard: для гостевых броней генерим token (см. /api/orders.post.ts комментарий).
  const guestToken = customerId ? null : randomUUID()

  const { data, error } = await db.crossTenant
    .from('reservations')
    .insert({
      tenant_id: tenantId,
      guest_name: body.guestName.trim(),
      guest_phone: body.guestPhone.trim(),
      guest_email: body.guestEmail?.trim() || null,
      guest_count: body.guestCount,
      reserved_date: reservedDate,
      reserved_time: normalizedTime,
      comment: body.comment?.trim() || null,
      branch_id: branchId,
      status,
      ...(customerId ? { customer_id: customerId } : { guest_token: guestToken }),
    })
    .select('id, status, guest_token')
    .single()

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return {
    id: data.id,
    status: data.status,
    linkedToAccount: !!customerId,
    token: (data.guest_token as string | null) ?? null,
  }
})
