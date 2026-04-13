import { getServerSupabase, getAuthSupabase } from '../../utils/supabase'
import { createRateLimiter, todayInTz, addDaysToDateStr } from '@fastio/shared'

const rateLimiter = createRateLimiter(5, 60_000)

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined

  if (!tenantId) throw createError({ statusCode: 404 })

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'

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

  const supabase = getServerSupabase()

  // Check module enabled
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('modules, timezone')
    .eq('id', tenantId)
    .single()

  if (!tenantData?.modules?.reservations) {
    throw createError({ statusCode: 400, message: 'Бронирование недоступно' })
  }

  // Get and validate settings
  const { data: settings } = await supabase
    .from('reservation_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (settings && !settings.enabled) {
    throw createError({ statusCode: 400, message: 'Бронирование недоступно' })
  }

  const minGuests = settings?.min_guests ?? 1
  const maxGuests = settings?.max_guests ?? 20
  const maxAdvanceDays = settings?.max_advance_days ?? 30
  const autoConfirm = settings?.auto_confirm ?? false

  // Validate guest count
  if (body.guestCount < minGuests || body.guestCount > maxGuests) {
    throw createError({
      statusCode: 400,
      message: `Количество гостей: от ${minGuests} до ${maxGuests}`,
    })
  }

  // Validate date range
  const tenantTz = (tenantData.timezone as string) ?? 'Europe/Moscow'
  const todayStr = todayInTz(tenantTz)

  if (body.reservedDate < todayStr) {
    throw createError({ statusCode: 400, message: 'Нельзя бронировать на прошедшую дату' })
  }

  const maxDateStr = addDaysToDateStr(todayStr, maxAdvanceDays)

  if (body.reservedDate > maxDateStr) {
    throw createError({ statusCode: 400, message: `Бронирование доступно не позднее чем за ${maxAdvanceDays} дней` })
  }

  // Try to identify authenticated customer
  let customerId: string | null = null
  const authHeader = getRequestHeader(event, 'authorization')

  if (authHeader) {
    try {
      const authClient = getAuthSupabase(authHeader)
      const { data: { user } } = await authClient.auth.getUser()

      if (user) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (customerData) customerId = customerData.id
      }
    } catch {
      // proceed as guest
    }
  }

  const status = autoConfirm ? 'confirmed' : 'pending'

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      tenant_id: tenantId,
      guest_name: body.guestName.trim(),
      guest_phone: body.guestPhone.trim(),
      guest_email: body.guestEmail?.trim() || null,
      guest_count: body.guestCount,
      reserved_date: body.reservedDate,
      reserved_time: body.reservedTime,
      comment: body.comment?.trim() || null,
      branch_id: body.branchId || null,
      status,
      ...(customerId && { customer_id: customerId }),
    })
    .select('id, status')
    .single()

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return { id: data.id, status: data.status, linkedToAccount: !!customerId }
})
