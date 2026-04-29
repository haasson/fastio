import { getServerSupabase, getAuthSupabase } from '../../utils/supabase'
import { createRateLimiter, todayInTz, localDateTimeToUtcIso, validateAndNormalizeRussianPhone, DEFAULT_TIMEZONE, addDaysToDateStr } from '@fastio/shared'
import { reportError } from '~/utils/reportError'

const rateLimiter = createRateLimiter(5, 60_000)

const NOTES_MAX_LENGTH = 1000

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const body = await readBody(event)

  // Валидация
  if (!body.customerName?.trim()) throw createError({ statusCode: 400, message: 'Укажите имя' })
  if (!body.customerPhone?.trim()) throw createError({ statusCode: 400, message: 'Укажите телефон' })
  const normalizedPhone = validateAndNormalizeRussianPhone(body.customerPhone)
  if (!normalizedPhone) {
    throw createError({ statusCode: 400, message: 'Некорректный номер телефона' })
  }
  if (!body.serviceId) throw createError({ statusCode: 400, message: 'Укажите услугу' })
  if (!body.date || !body.slotTime) throw createError({ statusCode: 400, message: 'Укажите дату и время' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw createError({ statusCode: 400, message: 'Некорректная дата' })
  if (!/^\d{2}:\d{2}$/.test(body.slotTime)) throw createError({ statusCode: 400, message: 'Некорректное время' })
  if (typeof body.notes === 'string' && body.notes.length > NOTES_MAX_LENGTH) {
    throw createError({ statusCode: 400, message: `Комментарий слишком длинный (макс. ${NOTES_MAX_LENGTH} символов)` })
  }

  const supabase = getServerSupabase()

  // Проверяем модуль и получаем настройки тенанта
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('modules, timezone, legal_info')
    .eq('id', tenantId)
    .single()

  if (!tenantData?.modules?.services) {
    throw createError({ statusCode: 400, message: 'Онлайн-запись недоступна' })
  }

  const tz = (tenantData.timezone as string) ?? DEFAULT_TIMEZONE
  const todayStr = todayInTz(tz)

  if (body.date < todayStr) {
    throw createError({ statusCode: 400, message: 'Нельзя выбрать прошедшую дату' })
  }

  // Проверяем настройки модуля
  const { data: settingsData } = await supabase
    .from('appointment_settings')
    .select('auto_confirm, booking_horizon_days, slot_step_minutes, allow_client_reschedule, allow_client_cancellation')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const autoConfirm = settingsData?.auto_confirm ?? false
  const horizon = (settingsData?.booking_horizon_days as number) ?? 30
  const allowReschedule = settingsData?.allow_client_reschedule ?? false
  const allowCancel = settingsData?.allow_client_cancellation ?? true

  const maxDate = addDaysToDateStr(todayStr, horizon)
  if (body.date > maxDate) {
    throw createError({ statusCode: 400, message: 'Дата вне горизонта бронирования' })
  }

  // Получаем услугу
  const { data: serviceData } = await supabase
    .from('services')
    .select('duration, is_bookable, name, price, category_id')
    .eq('id', body.serviceId)
    .eq('tenant_id', tenantId)
    .single()

  if (!serviceData?.is_bookable || !serviceData.duration) {
    throw createError({ statusCode: 400, message: 'Услуга недоступна для записи' })
  }

  const duration = serviceData.duration as number
  const serviceCategoryId = (serviceData.category_id as string | null) ?? null
  const serviceSnapshot = { name: serviceData.name as string, price: (serviceData.price as number) ?? 0 }

  // Tenant validation: branch must belong to this tenant.
  const branchId: string | null = body.branchId ?? null
  if (branchId) {
    const { data: branchRow } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!branchRow) {
      throw createError({ statusCode: 400, message: 'Указанный филиал не найден в этом тенанте' })
    }
  }

  // Вычисляем UTC времена
  const startsAt = localDateTimeToUtcIso(body.date as string, body.slotTime as string, tz)

  const endMinutes = (() => {
    const [h, m] = (body.slotTime as string).split(':').map(Number)
    return h * 60 + m + duration
  })()
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
  const endsAt = localDateTimeToUtcIso(body.date as string, endTime, tz)

  // Определяем ресурс: если клиент выбрал конкретного, используем его; иначе ищем свободного
  let resourceId: string | null = body.resourceId ?? null

  if (resourceId) {
    // Tenant validation: resource must belong to this tenant and be active.
    const { data: resourceRow } = await supabase
      .from('resources')
      .select('id')
      .eq('id', resourceId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle()
    if (!resourceRow) {
      throw createError({ statusCode: 400, message: 'Указанный исполнитель недоступен' })
    }

    // Resource must be linked to this service either explicitly via service_resources
    // or implicitly via resource_categories matching the service's category.
    const { data: explicitLink } = await supabase
      .from('service_resources')
      .select('resource_id')
      .eq('service_id', body.serviceId)
      .eq('resource_id', resourceId)
      .maybeSingle()

    let categoryLink: { resource_id: string } | null = null
    if (!explicitLink && serviceCategoryId) {
      const { data } = await supabase
        .from('resource_categories')
        .select('resource_id')
        .eq('category_id', serviceCategoryId)
        .eq('resource_id', resourceId)
        .maybeSingle()
      categoryLink = (data as { resource_id: string } | null) ?? null
    }

    if (!explicitLink && !categoryLink) {
      throw createError({ statusCode: 400, message: 'Этот исполнитель не оказывает выбранную услугу' })
    }
  } else {
    // Автоматически назначаем первый свободный ресурс. Учитываем оба источника
    // привязки: явный (service_resources) и через категорию (resource_categories) —
    // иначе для услуг, где исполнители заданы только через категорию, кандидатов
    // не будет и create_appointment упадёт с P0001.
    const [{ data: explicitRes }, { data: categoryRes }] = await Promise.all([
      supabase.from('service_resources').select('resource_id').eq('service_id', body.serviceId),
      serviceCategoryId
        ? supabase.from('resource_categories').select('resource_id').eq('category_id', serviceCategoryId)
        : Promise.resolve({ data: [] as { resource_id: string }[] }),
    ])

    let candidateIds = Array.from(new Set([
      ...(explicitRes ?? []).map((r) => r.resource_id as string),
      ...(categoryRes ?? []).map((r) => r.resource_id as string),
    ]))

    if (branchId && candidateIds.length) {
      const { data: branchLinks } = await supabase
        .from('resource_branches')
        .select('resource_id')
        .in('resource_id', candidateIds)
        .eq('branch_id', branchId)

      const allowed = new Set((branchLinks ?? []).map((r) => r.resource_id as string))
      candidateIds = candidateIds.filter((id) => allowed.has(id))
    }

    if (candidateIds.length > 0) {
      // Capacity-aware: для ресурса с capacity>=2 (например бильярдные столы)
      // один пересекающийся appointment не делает его занятым. Считаем количество
      // пересечений и сравниваем с capacity. RPC create_appointment атомарно
      // перепроверит под advisory lock — здесь просто отсеиваем заведомо полные.
      const [{ data: caps }, { data: conflicting }] = await Promise.all([
        supabase.from('resources').select('id, capacity').in('id', candidateIds),
        supabase
          .from('appointments')
          .select('resource_id')
          .in('resource_id', candidateIds)
          .not('status', 'eq', 'cancelled')
          .lt('starts_at', endsAt)
          .gt('ends_at', startsAt),
      ])

      const capacityById = new Map(
        (caps ?? []).map((r) => [r.id as string, (r.capacity as number) ?? 1]),
      )
      const overlapCount = new Map<string, number>()
      for (const row of (conflicting ?? [])) {
        const id = row.resource_id as string
        overlapCount.set(id, (overlapCount.get(id) ?? 0) + 1)
      }

      resourceId = candidateIds.find((id) => (overlapCount.get(id) ?? 0) < (capacityById.get(id) ?? 1)) ?? null
    }
  }

  // Определяем userId и customerId. Гость: оба null.
  let userId: string | null = null
  let customerId: string | null = null
  const authHeader = getHeader(event, 'authorization')
  if (authHeader) {
    const { data: { user } } = await getAuthSupabase(authHeader).auth.getUser()
    userId = user?.id ?? null
    if (userId) {
      const { data: customerRow } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('auth_user_id', userId)
        .maybeSingle()
      customerId = (customerRow?.id as string | undefined) ?? null
    }
  }

  // Атомарное создание через RPC: advisory_xact_lock + capacity-aware check + insert.
  const { data: rpcRows, error } = await supabase.rpc('create_appointment', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_service_id: body.serviceId,
    p_resource_id: resourceId,
    p_user_id: userId,
    p_customer_id: customerId,
    p_customer_name: body.customerName.trim(),
    p_customer_phone: normalizedPhone,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_status: autoConfirm ? 'confirmed' : 'new',
    p_notes: body.notes?.trim() || null,
    p_allow_reschedule_snapshot: allowReschedule,
    p_allow_cancel_snapshot: allowCancel,
    p_service_name: serviceSnapshot.name,
    p_service_price: serviceSnapshot.price,
  })

  if (error) {
    // P0001 — invariant (resource gone). P0002 — slot taken (conflict).
    const code = (error as { code?: string }).code
    if (code === 'P0002') {
      throw createError({ statusCode: 409, message: 'Это время уже занято. Выберите другое.' })
    }
    if (code === 'P0001') {
      throw createError({ statusCode: 400, message: 'Исполнитель недоступен' })
    }
    reportError(error)
    throw createError({ statusCode: 500, message: 'Не удалось создать запись' })
  }

  const created = (rpcRows as Array<{ id: string; status: string; starts_at: string; ends_at: string }>)?.[0]
  if (!created) {
    throw createError({ statusCode: 500, message: 'Не удалось создать запись' })
  }

  return {
    id: created.id,
    status: created.status,
    startsAt: created.starts_at,
    endsAt: created.ends_at,
  }
})
