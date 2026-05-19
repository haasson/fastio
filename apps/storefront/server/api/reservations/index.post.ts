import { randomUUID } from 'node:crypto'
import { getAuthSupabase, resolveMaxGuests } from '../../utils/supabase'
import { getTenantDb } from '../../utils/tenantDb'
import { getClientIp } from '../../utils/clientIp'
import { enforceRateLimit } from '../../utils/enforceRateLimit'
import { reportError } from '~/shared/utils/reportError'
import { todayInTz, nowTimeInTz, addDaysToDateStr, getIsoDayForDate, generateTimeSlots, timeToMinutes, validateAndNormalizeRussianPhone, DEFAULT_TIMEZONE } from '@fastio/shared'
import type { WorkingHours, WorkingHoursSchedule, ReservationStatus } from '@fastio/shared'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const { tenantId } = db

  const ip = getClientIp(event)
  await enforceRateLimit(
    [{ key: `reservations:tenant-ip:${tenantId}:${ip}`, max: 5, windowSeconds: 60 }],
    'Слишком много запросов. Попробуйте позже.',
  )

  const body = await readBody(event)

  // Basic validation
  if (!body.guestName?.trim()) {
    throw createError({ statusCode: 400, message: 'Укажите имя' })
  }
  if (!body.guestPhone?.trim()) {
    throw createError({ statusCode: 400, message: 'Укажите телефон' })
  }
  // Канонизируем телефон в '7XXXXXXXXXX' через shared-утилку.
  // Раньше принимали 10–12 цифр без нормализации формы — в БД попадали и
  // '+7 (999)…', и '8999…', и '79991234567'. Это ломало поиск клиента по
  // телефону в админке. Теперь храним единый формат.
  const normalizedGuestPhone = validateAndNormalizeRussianPhone(body.guestPhone)
  if (!normalizedGuestPhone) {
    throw createError({ statusCode: 400, message: 'Некорректный номер телефона' })
  }
  if (!body.reservedDate || !body.reservedTime) {
    throw createError({ statusCode: 400, message: 'Укажите дату и время' })
  }
  if (!Number.isInteger(body.guestCount) || body.guestCount < 1) {
    throw createError({ statusCode: 400, message: 'Укажите количество гостей' })
  }

  // Check module enabled
  const { data: tenantData, error: tenantError } = await db
    .from('tenants')
    .select('modules, timezone, working_hours_schedule')
    .single()

  if (tenantError) {
    reportError(tenantError, { context: 'reservations.post:tenant-lookup' })
    throw createError({ statusCode: 500, message: 'Не удалось загрузить настройки' })
  }
  if (!tenantData?.modules?.reservations) {
    throw createError({ statusCode: 400, message: 'Бронирование недоступно' })
  }

  // Get and validate settings
  const { data: settings, error: settingsError } = await db
    .from('reservation_settings')
    .select('*')
    .maybeSingle()

  if (settingsError) {
    reportError(settingsError, { context: 'reservations.post:settings-lookup' })
    throw createError({ statusCode: 500, message: 'Не удалось загрузить настройки' })
  }

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

  // PREPROD-014: idempotency-key защищает от двойного тапа / refresh во время
  // submit / медленной сети. UNIQUE per tenant (mig 287). При повторе с тем же
  // ключом — отдаём существующую бронь (catch 23505 → SELECT), не создаём вторую.
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim()
    : null

  // PREPROD-018: snapshot настройки «клиент может отменять» (mig 288) — чтобы
  // тенант не мог ретроактивно лишить клиента права на отмену уже сделанной
  // брони. Default true (как и сама колонка settings).
  const allowCancelSnapshot = (settings?.allow_client_cancellation as boolean | undefined) ?? true

  const { data, error } = await db.crossTenant
    .from('reservations')
    .insert({
      tenant_id: tenantId,
      guest_name: body.guestName.trim(),
      guest_phone: normalizedGuestPhone,
      guest_email: body.guestEmail?.trim() || null,
      guest_count: body.guestCount,
      reserved_date: reservedDate,
      reserved_time: normalizedTime,
      comment: body.comment?.trim() || null,
      branch_id: branchId,
      status,
      idempotency_key: idempotencyKey,
      allow_cancel_snapshot: allowCancelSnapshot,
      ...(customerId ? { customer_id: customerId } : { guest_token: guestToken }),
    })
    .select('id, status, guest_token')
    .single()

  if (error) {
    if (error.code === '23505' && idempotencyKey) {
      // Race: одновременно прошёл второй запрос с тем же ключом, бронь уже создана.
      // Безопасно отдавать guest_token владельцу retry'я: idempotency_key — 122-битный
      // UUID, генерируется клиентом через crypto.randomUUID() и известен ТОЛЬКО
      // оригинальному автору. НЕ логировать idempotency_key в открытом виде.
      //
      // maybeSingle (не single): между catch 23505 и SELECT winner может ещё быть
      // в транзакции (read-committed snapshot), запись не видна. Тогда existing=null
      // → проваливаемся в общий throw 500 без шума в Sentry (race-cases частые).
      const { data: existing, error: lookupError } = await db
        .from('reservations')
        .select('id, status, guest_token, customer_id')
        .eq('idempotency_key', idempotencyKey)
        .returns<{ id: string; status: ReservationStatus; guest_token: string | null; customer_id: string | null }[]>()
        .maybeSingle()

      if (lookupError) {
        reportError(lookupError, { context: 'reservations.post:idempotency-lookup', tenantId })
        throw createError({ statusCode: 500, message: 'Не удалось создать бронь' })
      }

      if (existing) {
        return {
          id: existing.id,
          status: existing.status,
          linkedToAccount: !!existing.customer_id,
          token: existing.guest_token ?? null,
        }
      }
      // existing=null → winner ещё в транзакции, fallthrough в общий 500
    }

    reportError(error, { context: 'reservations.post:insert', tenantId })
    throw createError({ statusCode: 500, message: 'Не удалось создать бронь' })
  }

  return {
    id: data.id,
    status: data.status,
    linkedToAccount: !!customerId,
    token: (data.guest_token as string | null) ?? null,
  }
})
