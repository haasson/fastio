import { getTenantDb } from '../../utils/tenantDb'
import { getAuthenticatedContextWithCustomer } from '../../utils/customerAuth'
import { createRateLimiter, todayInTz, localDateTimeToUtcIso, validateAndNormalizeRussianPhone, DEFAULT_TIMEZONE, addDaysToDateStr, DEFAULT_APPOINTMENT_SETTINGS } from '@fastio/shared'
import { reportError } from '~/utils/reportError'

const rateLimiter = createRateLimiter(5, 60_000)

const NOTES_MAX_LENGTH = 1000

export type BulkItem = {
  serviceId: string
  // null = клиент выбрал «любой исполнитель», бэк сам подберёт по round-robin.
  resourceId: string | null
  startTime: string  // "HH:MM"
  // true ⇒ слот в overnight-фазе следующего дня (смена с 22:00 D, слот 01:00 D+1).
  // UTC старт строится как `localDateTimeToUtcIso(date+1, startTime, tz)`.
  isNextDay?: boolean
}

export type BulkPayload = {
  customerName: string
  customerPhone: string
  date: string
  items: BulkItem[]
  branchId: string | null
}

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const { tenantId } = db

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
    // resourceId может быть null — это «любой исполнитель», бэк подберёт сам.
    if (!item.startTime || !/^\d{2}:\d{2}$/.test(item.startTime)) {
      throw createError({ statusCode: 400, message: 'Каждый элемент должен содержать startTime (HH:MM)' })
    }
  }

  // Проверяем модуль и получаем настройки тенанта
  const { data: tenantData } = await db
    .from('tenants')
    .select('modules, timezone')
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
  const { data: settingsData } = await db
    .from('appointment_settings')
    .select('auto_confirm, booking_horizon_days, allow_client_reschedule, allow_client_cancellation')
    .maybeSingle()

  const autoConfirm = settingsData?.auto_confirm ?? DEFAULT_APPOINTMENT_SETTINGS.autoConfirm
  const horizon = (settingsData?.booking_horizon_days as number | null) ?? DEFAULT_APPOINTMENT_SETTINGS.bookingHorizonDays
  const allowReschedule = settingsData?.allow_client_reschedule ?? DEFAULT_APPOINTMENT_SETTINGS.allowClientReschedule
  const allowCancel = settingsData?.allow_client_cancellation ?? DEFAULT_APPOINTMENT_SETTINGS.allowClientCancellation

  const maxDate = addDaysToDateStr(todayStr, horizon)
  if (body.date > maxDate) {
    throw createError({ statusCode: 400, message: 'Дата вне горизонта бронирования' })
  }

  // Tenant validation: branch must belong to this tenant.
  const branchId: string | null = body.branchId ?? null
  if (branchId) {
    const { data: branchRow } = await db
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .maybeSingle()
    if (!branchRow) {
      throw createError({ statusCode: 400, message: 'Указанный филиал не найден в этом тенанте' })
    }
  }

  const items = body.items as BulkItem[]
  const serviceIds = [...new Set(items.map((i) => i.serviceId))]
  // Только для items с явно заданным мастером — для них валидируем тенант/компетенции.
  // Items с null собираются отдельно ниже и для каждого бэк сам подбирает кандидата.
  const resourceIds = [...new Set(items.map((i) => i.resourceId).filter((r): r is string => r !== null))]

  // Загружаем услуги (фильтрация по tenant)
  const { data: servicesData } = await db
    .from('services')
    .select('id, duration, is_bookable, name, price, category_id')
    .in('id', serviceIds)

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
    // Защита расчёта end-даты: если duration ≥ 1440, end может выпрыгнуть на +2
    // суток, а слот-движок не материализует слоты длиннее окна работы. Услуги
    // такой длины — продуктовая ошибка, отказываем.
    if (svc.duration >= 1440) {
      throw createError({ statusCode: 400, message: `Услуга "${svc.name}" имеет недопустимую длительность (≥ 24 ч)` })
    }
  }

  // Tenant validation: каждый ресурс принадлежит этому тенанту и активен.
  const { data: resourceRows } = await db
    .from('resources')
    .select('id, name')
    .in('id', resourceIds)
    .eq('is_active', true)

  const validResourceIds = new Set((resourceRows ?? []).map((r) => r.id as string))
  for (const rid of resourceIds) {
    if (!validResourceIds.has(rid)) {
      throw createError({ statusCode: 400, message: 'Указан недоступный исполнитель' })
    }
  }

  // Связь service↔resource: либо явная (service_resources), либо через категорию услуги.
  // safe: serviceIds and resourceIds are both validated against tenantId in the queries above
  const [{ data: explicitLinks }, { data: categoryLinks }] = await Promise.all([
    db.junction('service_resources').select('service_id, resource_id').in('service_id', serviceIds).in('resource_id', resourceIds),
    db.junction('resource_categories').select('category_id, resource_id').in('resource_id', resourceIds),
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
    if (!item.resourceId) continue
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
  type ResolvedItem = {
    serviceId: string
    resourceId: string | null
    startTime: string
    startsAt: string
    endsAt: string
    duration: number
    serviceName: string
    servicePrice: number
    // 'client' если клиент явно выбрал мастера, 'auto' если бэк подобрал.
    assignedBy: 'client' | 'auto'
  }

  const resolvedItems: ResolvedItem[] = items.map((item) => {
    const svc = serviceById.get(item.serviceId)!
    const duration = svc.duration

    // overnight: если слот в фазе D+1, локальная дата старта = body.date+1.
    // duration < 1440 (валидация выше) ⇒ end может уехать максимум на +1 сутки
    // от startDate, две полуночи не пересекаются.
    const startDate = item.isNextDay ? addDaysToDateStr(body.date as string, 1) : (body.date as string)
    const startsAt = localDateTimeToUtcIso(startDate, item.startTime, tz)

    const [h, m] = item.startTime.split(':').map(Number)
    const endMinutes = h * 60 + m + duration
    // Если end вышел за 24:00 (внутри своих суток), переносим end-дату на +1.
    const endNextDay = endMinutes >= 1440
    const endNormalized = endMinutes % 1440
    const endTime = `${String(Math.floor(endNormalized / 60)).padStart(2, '0')}:${String(endNormalized % 60).padStart(2, '0')}`
    const endDate = endNextDay ? addDaysToDateStr(startDate, 1) : startDate
    const endsAt = localDateTimeToUtcIso(endDate, endTime, tz)

    return {
      serviceId: item.serviceId,
      resourceId: item.resourceId,
      startTime: item.startTime,
      startsAt, endsAt, duration,
      serviceName: svc.name, servicePrice: svc.price,
      assignedBy: item.resourceId ? 'client' : 'auto',
    }
  })

  // Авто-подбор для items без resourceId («любой исполнитель»). Round-robin по
  // дневной нагрузке: среди свободных кандидатов выбираем того, у кого меньше
  // всего активных броней в этот календарный день. При равной нагрузке —
  // стабильный порядок (по resource.id), чтобы тесты были детерминированы.
  const autoItems = resolvedItems.filter((it) => !it.resourceId)

  if (autoItems.length > 0) {
    // Кандидатов соберём из service_resources + resource_categories для нужных услуг,
    // затем отфильтруем по тенанту/active/филиалу.
    const autoServiceIds = [...new Set(autoItems.map((it) => it.serviceId))]
    const autoCategoryIds = [...new Set(
      autoServiceIds.map((sid) => serviceById.get(sid)?.category_id).filter((id): id is string => !!id),
    )]

    // safe: autoServiceIds and autoCategoryIds are derived from tenant-validated service rows above
    const [{ data: directRes }, { data: categoryRes }, { data: candidatesRows }] = await Promise.all([
      db.junction('service_resources').select('service_id, resource_id').in('service_id', autoServiceIds),
      autoCategoryIds.length
        ? db.junction('resource_categories').select('category_id, resource_id').in('category_id', autoCategoryIds)
        : Promise.resolve({ data: [] as Array<{ category_id: string; resource_id: string }> }),
      db.from('resources').select('id').eq('is_active', true),
    ])

    const activeIds = new Set((candidatesRows ?? []).map((r) => r.id as string))

    const candidatesByService = new Map<string, Set<string>>()
    for (const sid of autoServiceIds) candidatesByService.set(sid, new Set())

    for (const row of (directRes ?? []) as Array<{ service_id: string; resource_id: string }>) {
      if (activeIds.has(row.resource_id)) candidatesByService.get(row.service_id)?.add(row.resource_id)
    }
    const categoryToServices = new Map<string, string[]>()
    for (const sid of autoServiceIds) {
      const cid = serviceById.get(sid)?.category_id
      if (!cid) continue
      const arr = categoryToServices.get(cid) ?? []
      arr.push(sid)
      categoryToServices.set(cid, arr)
    }
    for (const row of (categoryRes ?? []) as Array<{ category_id: string; resource_id: string }>) {
      if (!activeIds.has(row.resource_id)) continue
      for (const sid of categoryToServices.get(row.category_id) ?? []) {
        candidatesByService.get(sid)?.add(row.resource_id)
      }
    }

    // Если задан филиал — отбрасываем кандидатов, не привязанных к нему.
    if (branchId) {
      const allCandidateIds = [...new Set(
        Array.from(candidatesByService.values()).flatMap((s) => Array.from(s)),
      )]
      if (allCandidateIds.length) {
        const { data: branchLinks } = await db
          .junction('resource_branches')
          .select('resource_id, branch_id')
          .in('resource_id', allCandidateIds)

        const linksByResource = new Map<string, string[]>()
        for (const row of (branchLinks ?? []) as Array<{ resource_id: string; branch_id: string }>) {
          const arr = linksByResource.get(row.resource_id) ?? []
          arr.push(row.branch_id)
          linksByResource.set(row.resource_id, arr)
        }
        for (const set of candidatesByService.values()) {
          for (const id of Array.from(set)) {
            const links = linksByResource.get(id) ?? []
            if (links.length > 0 && !links.includes(branchId)) set.delete(id)
          }
        }
      }
    }

    // Дневная нагрузка: COUNT по resource_id за весь календарный день.
    const dayStartUtc = localDateTimeToUtcIso(body.date as string, '00:00', tz)
    const dayEndUtc = localDateTimeToUtcIso(addDaysToDateStr(body.date as string, 1), '00:00', tz)

    const allCandIds = [...new Set(
      Array.from(candidatesByService.values()).flatMap((s) => Array.from(s)),
    )]

    const loadByResource = new Map<string, number>()
    if (allCandIds.length) {
      const { data: loadRows } = await db
        .from('appointments')
        .select('resource_id')
        .in('resource_id', allCandIds)
        .neq('status', 'cancelled')
        .gte('starts_at', dayStartUtc)
        .lt('starts_at', dayEndUtc)

      for (const row of (loadRows ?? []) as Array<{ resource_id: string }>) {
        loadByResource.set(row.resource_id, (loadByResource.get(row.resource_id) ?? 0) + 1)
      }
    }

    // Локальные «уже забронированные внутри текущего bulk» — учитываем чтобы
    // round-robin не выбрал одного и того же мастера два раза подряд.
    const localBookings = new Map<string, number>()
    const reserveLocal = (rid: string) => localBookings.set(rid, (localBookings.get(rid) ?? 0) + 1)

    for (const it of resolvedItems) {
      if (it.resourceId) continue
      const candidates = Array.from(candidatesByService.get(it.serviceId) ?? [])
      if (candidates.length === 0) {
        throw createError({ statusCode: 400, message: `Для услуги "${it.serviceName}" нет доступных исполнителей` })
      }

      // Отсеиваем тех, кто уже занят на (it.startsAt, it.endsAt). Простой запрос
      // overlap по каждому кандидату — RPC всё равно сделает атомарный capacity-чек,
      // мы лишь подбираем «обоснованного» кандидата.
      const { data: busyRows } = await db
        .from('appointments')
        .select('resource_id')
        .in('resource_id', candidates)
        .neq('status', 'cancelled')
        .lt('starts_at', it.endsAt)
        .gt('ends_at', it.startsAt)

      const busy = new Set((busyRows ?? []).map((r) => r.resource_id as string))
      const free = candidates.filter((id) => !busy.has(id) && (localBookings.get(id) ?? 0) === 0)

      if (free.length === 0) {
        throw createError({
          statusCode: 409,
          message: `На время ${it.startTime} нет свободных исполнителей для "${it.serviceName}". Выберите другое время.`,
        })
      }

      // Round-robin: min нагрузки + стабильный порядок при равенстве.
      free.sort((a, b) => {
        const la = (loadByResource.get(a) ?? 0) + (localBookings.get(a) ?? 0)
        const lb = (loadByResource.get(b) ?? 0) + (localBookings.get(b) ?? 0)
        if (la !== lb) return la - lb

        return a < b ? -1 : 1
      })

      it.resourceId = free[0]
      reserveLocal(free[0])
    }
  }

  // Определяем userId и customerId. Гость: оба null.
  // getAuthenticatedContextWithCustomer поддерживает оба способа входа: Bearer JWT и Telegram-куку.
  let userId: string | null = null
  let customerId: string | null = null
  try {
    const authCtx = await getAuthenticatedContextWithCustomer(event)
    customerId = authCtx.customer.id
    userId = authCtx.customer.authUserId
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode
    if (status !== 401 && status !== 404) throw e
    // гость или сессия истекла — продолжаем без идентификации
  }

  // Атомарная вставка через RPC: advisory_xact_lock per resource + capacity-aware
  // checks + INSERT'ы. Либо все ок, либо ничего не записано.
  // Audit-event 'group_created' пока не пишется — см. TECHDEBT.md.
  const rpcItems = resolvedItems.map((it) => ({
    service_id: it.serviceId,
    resource_id: it.resourceId,
    starts_at: it.startsAt,
    ends_at: it.endsAt,
    service_name: it.serviceName,
    service_price: it.servicePrice,
    resource_assigned_by: it.assignedBy,
  }))

  const { data: rpcResult, error } = await db.raw.rpc('create_appointments_bulk', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_user_id: userId,
    p_customer_id: customerId,
    p_customer_name: body.customerName.trim(),
    p_customer_phone: normalizedPhone,
    p_customer_email: (body.customerEmail as string | undefined)?.trim() || null,
    p_status: autoConfirm ? 'confirmed' : 'new',
    p_notes: body.notes?.trim() || null,
    p_allow_reschedule_snapshot: allowReschedule,
    p_allow_cancel_snapshot: allowCancel,
    p_source: 'storefront',
    p_items: rpcItems,
  })

  if (error) {
    const code = (error as { code?: string }).code
    const message = (error as { message?: string }).message
    if (code === 'P0002' || message?.includes('Slot is taken')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Время уже занято, выберите другое',
      })
    }
    if (code === 'P0001') {
      throw createError({ statusCode: 400, statusMessage: message ?? 'Не удалось создать запись' })
    }
    reportError(error)
    throw createError({ statusCode: 500, message: 'Не удалось создать запись' })
  }

  type RpcResponse = { group_id: string; appointments: Array<{ id: string; service_id: string; starts_at: string; ends_at: string }> }
  const parsed = rpcResult as RpcResponse | null
  if (!parsed?.appointments?.length) {
    reportError(new Error('[bulk] RPC returned unexpected result'))
    throw createError({ statusCode: 500, message: 'Не удалось создать запись' })
  }

  return {
    visitId: parsed.group_id,
    appointments: parsed.appointments.map((row) => ({
      id: row.id,
      serviceId: row.service_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    })),
  }
})
