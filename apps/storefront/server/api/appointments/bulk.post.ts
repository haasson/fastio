import { getServerSupabase, getAuthSupabase } from '../../utils/supabase'
import { createRateLimiter, todayInTz, localDateTimeToUtcIso, validateAndNormalizeRussianPhone, DEFAULT_TIMEZONE, addDaysToDateStr } from '@fastio/shared'
import { reportError } from '~/utils/reportError'

const rateLimiter = createRateLimiter(5, 60_000)

const NOTES_MAX_LENGTH = 1000

type BulkItem = {
  serviceId: string
  resourceId: string
  startTime: string  // "HH:MM"
}

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
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw createError({ statusCode: 400, message: 'Укажите корректную дату (YYYY-MM-DD)' })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, message: 'Укажите хотя бы одну услугу' })
  }
  if (typeof body.notes === 'string' && body.notes.length > NOTES_MAX_LENGTH) {
    throw createError({ statusCode: 400, message: `Комментарий слишком длинный (макс. ${NOTES_MAX_LENGTH} символов)` })
  }
  for (const item of body.items as BulkItem[]) {
    if (!item.serviceId) throw createError({ statusCode: 400, message: 'Каждый элемент должен содержать serviceId' })
    if (!item.resourceId) throw createError({ statusCode: 400, message: 'Каждый элемент должен содержать resourceId' })
    if (!item.startTime || !/^\d{2}:\d{2}$/.test(item.startTime)) {
      throw createError({ statusCode: 400, message: 'Каждый элемент должен содержать startTime (HH:MM)' })
    }
  }

  const supabase = getServerSupabase()

  // Проверяем модуль и получаем настройки тенанта
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

  if (body.date < todayStr) {
    throw createError({ statusCode: 400, message: 'Нельзя выбрать прошедшую дату' })
  }

  // Получаем настройки модуля
  const { data: settingsData } = await supabase
    .from('appointment_settings')
    .select('auto_confirm, booking_horizon_days, allow_client_reschedule, allow_client_cancellation')
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

  const items = body.items as BulkItem[]
  const serviceIds = [...new Set(items.map((i) => i.serviceId))]
  const resourceIds = [...new Set(items.map((i) => i.resourceId))]

  // Загружаем услуги (фильтрация по tenant)
  const { data: servicesData } = await supabase
    .from('services')
    .select('id, duration, is_bookable, name, price, category_id')
    .in('id', serviceIds)
    .eq('tenant_id', tenantId)

  type ServiceRow = { id: string; duration: number; is_bookable: boolean; name: string; price: number; category_id: string | null }
  const serviceById = new Map<string, ServiceRow>(
    (servicesData ?? []).map((row) => [
      row.id as string,
      {
        id: row.id as string,
        duration: row.duration as number,
        is_bookable: row.is_bookable as boolean,
        name: row.name as string,
        price: (row.price as number) ?? 0,
        category_id: row.category_id as string | null,
      },
    ]),
  )

  for (const item of items) {
    const svc = serviceById.get(item.serviceId)
    if (!svc) {
      throw createError({ statusCode: 400, message: `Услуга ${item.serviceId} не найдена в этом тенанте` })
    }
    if (!svc.is_bookable || !svc.duration) {
      throw createError({ statusCode: 400, message: `Услуга "${svc.name}" недоступна для записи` })
    }
  }

  // Tenant validation: каждый ресурс принадлежит этому тенанту и активен.
  const { data: resourceRows } = await supabase
    .from('resources')
    .select('id, name')
    .in('id', resourceIds)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  const validResourceIds = new Set((resourceRows ?? []).map((r) => r.id as string))
  for (const rid of resourceIds) {
    if (!validResourceIds.has(rid)) {
      throw createError({ statusCode: 400, message: 'Указан недоступный исполнитель' })
    }
  }

  // Связь service↔resource: либо явная (service_resources), либо через категорию услуги.
  const [{ data: explicitLinks }, { data: categoryLinks }] = await Promise.all([
    supabase.from('service_resources').select('service_id, resource_id').in('service_id', serviceIds).in('resource_id', resourceIds),
    supabase.from('resource_categories').select('category_id, resource_id').in('resource_id', resourceIds),
  ])

  const explicitLinkSet = new Set(
    ((explicitLinks ?? []) as Array<{ service_id: string; resource_id: string }>)
      .map((r) => `${r.service_id}|${r.resource_id}`),
  )
  const resourceToCategories = new Map<string, Set<string>>()
  for (const row of (categoryLinks ?? []) as Array<{ category_id: string; resource_id: string }>) {
    const set = resourceToCategories.get(row.resource_id) ?? new Set<string>()
    set.add(row.category_id)
    resourceToCategories.set(row.resource_id, set)
  }

  for (const item of items) {
    const svc = serviceById.get(item.serviceId)!
    const directLink = explicitLinkSet.has(`${item.serviceId}|${item.resourceId}`)
    const categoryLink = svc.category_id
      ? (resourceToCategories.get(item.resourceId)?.has(svc.category_id) ?? false)
      : false
    if (!directLink && !categoryLink) {
      throw createError({
        statusCode: 400,
        message: `Исполнитель не оказывает услугу "${svc.name}"`,
      })
    }
  }

  // Вычисляем временные интервалы для каждого item
  type ResolvedItem = BulkItem & { startsAt: string; endsAt: string; duration: number; serviceName: string; servicePrice: number }

  const resolvedItems: ResolvedItem[] = items.map((item) => {
    const svc = serviceById.get(item.serviceId)!
    const duration = svc.duration

    const startsAt = localDateTimeToUtcIso(body.date as string, item.startTime, tz)

    const [h, m] = item.startTime.split(':').map(Number)
    const endMinutes = h * 60 + m + duration
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
    const endsAt = localDateTimeToUtcIso(body.date as string, endTime, tz)

    return { ...item, startsAt, endsAt, duration, serviceName: svc.name, servicePrice: svc.price }
  })

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

  // Атомарная вставка через RPC: advisory_xact_lock per resource + capacity-aware
  // checks + INSERT'ы. Либо все ок, либо ничего не записано.
  const rpcItems = resolvedItems.map((it) => ({
    service_id: it.serviceId,
    resource_id: it.resourceId,
    starts_at: it.startsAt,
    ends_at: it.endsAt,
    service_name: it.serviceName,
    service_price: it.servicePrice,
  }))

  const { data: rpcRows, error } = await supabase.rpc('create_appointments_bulk', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_user_id: userId,
    p_customer_id: customerId,
    p_customer_name: body.customerName.trim(),
    p_customer_phone: normalizedPhone,
    p_status: autoConfirm ? 'confirmed' : 'new',
    p_notes: body.notes?.trim() || null,
    p_allow_reschedule_snapshot: allowReschedule,
    p_allow_cancel_snapshot: allowCancel,
    p_items: rpcItems,
  })

  if (error) {
    const code = (error as { code?: string }).code
    if (code === 'P0002') {
      throw createError({
        statusCode: 409,
        message: 'Один из выбранных слотов уже занят. Выберите другое время.',
      })
    }
    if (code === 'P0001') {
      throw createError({ statusCode: 400, message: 'Исполнитель недоступен' })
    }
    reportError(error)
    throw createError({ statusCode: 500, message: 'Не удалось создать запись' })
  }

  type CreatedRow = { id: string; service_id: string; starts_at: string; ends_at: string }
  const created = ((rpcRows as CreatedRow[]) ?? []).map((row) => ({
    id: row.id,
    serviceId: row.service_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }))

  return { appointments: created }
})
