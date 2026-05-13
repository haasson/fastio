import { getTenantDb } from '../../utils/tenantDb'
import { getClientIp } from '../../utils/clientIp'
import { getAuthenticatedContext } from '../../utils/customerAuth'
import { createRateLimiter } from '@fastio/shared'
import { reportError } from '~/shared/utils/reportError'

const rateLimiter = createRateLimiter(5, 60_000)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PHONE_REGEX = /^[0-9+\-() ]+$/
// Простая проверка вида user@host.tld — ровно один @, точка в host. Длиной до 254
// (RFC 5321). Не претендует на полное соответствие RFC 5322 — задача отсечь мусор
// и явные опечатки на этапе INSERT, а не валидировать «всё что разрешено».
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const { tenantId } = db

  const ip = getClientIp(event)
  if (!rateLimiter.check(`appointments-request:${ip}`)) {
    throw createError({ statusCode: 429, message: 'Слишком много заявок, попробуйте через минуту.' })
  }

  const body = await readBody(event)

  // Валидация
  const customerName = (body.customerName as string | undefined)?.trim() ?? ''
  if (customerName.length < 1 || customerName.length > 200) {
    throw createError({ statusCode: 400, message: 'Укажите корректное имя (1–200 символов)' })
  }

  const customerPhone = (body.customerPhone as string | undefined)?.trim() ?? ''
  if (customerPhone.length < 5 || customerPhone.length > 30 || !PHONE_REGEX.test(customerPhone)) {
    throw createError({ statusCode: 400, message: 'Укажите корректный номер телефона' })
  }

  const notes = (body.notes as string | undefined)?.trim() || null
  if (notes && notes.length > 1000) {
    throw createError({ statusCode: 400, message: 'Примечания слишком длинные (макс. 1000 символов)' })
  }

  const customerEmail = (body.customerEmail as string | undefined)?.trim() || null
  if (customerEmail !== null) {
    if (customerEmail.length > 254 || !EMAIL_REGEX.test(customerEmail)) {
      throw createError({ statusCode: 400, message: 'Некорректный email' })
    }
  }

  const branchId = (body.branchId as string | undefined) ?? null
  if (branchId && !UUID_REGEX.test(branchId)) {
    throw createError({ statusCode: 400, message: 'Некорректный идентификатор филиала' })
  }

  const rawServices = body.services as Array<{ serviceId?: string; preferredResourceId?: string | null }> | undefined
  if (!Array.isArray(rawServices) || rawServices.length < 1) {
    throw createError({ statusCode: 400, message: 'Укажите хотя бы одну услугу' })
  }
  if (rawServices.length > 20) {
    throw createError({ statusCode: 400, message: 'Слишком много услуг (макс. 20)' })
  }
  for (const svc of rawServices) {
    if (!svc.serviceId || !UUID_REGEX.test(svc.serviceId)) {
      throw createError({ statusCode: 400, message: 'Некорректный идентификатор услуги' })
    }
  }

  // Опциональная аутентификация: guest-запросы разрешены
  let customerId: string | null = null
  try {
    const authCtx = await getAuthenticatedContext(event)
    customerId = authCtx.customerId
  } catch {
    // гость — продолжаем без customer_id
  }

  // Дозагрузка услуг, проверка принадлежности тенанту и доступности
  const serviceIds = [...new Set(rawServices.map((s) => s.serviceId as string))]
  const { data: servicesData, error: servicesError } = await db
    .from('services')
    .select('id, name, duration, price, is_bookable')
    .in('id', serviceIds)

  if (servicesError) {
    reportError(servicesError)
    throw createError({ statusCode: 500, message: 'Ошибка загрузки услуг' })
  }

  type ServiceRow = { id: string; name: string; duration: number; price: number; is_bookable: boolean }
  const serviceById = new Map<string, ServiceRow>(
    (servicesData ?? []).map((r) => [r.id as string, r as unknown as ServiceRow]),
  )

  for (const id of serviceIds) {
    const svc = serviceById.get(id)
    if (!svc) {
      throw createError({ statusCode: 400, message: `Услуга не найдена в этом тенанте` })
    }
    if (!svc.is_bookable) {
      throw createError({ statusCode: 400, message: `Услуга "${svc.name}" недоступна для записи` })
    }
  }

  // Дозагрузка предпочтительных исполнителей (тихо игнорируем невалидные)
  const preferredIds = rawServices
    .map((s) => s.preferredResourceId ?? null)
    .filter((id): id is string => id !== null && UUID_REGEX.test(id))

  const validPreferredIds = new Set<string>()
  if (preferredIds.length > 0) {
    const { data: resourceRows } = await db
      .from('resources')
      .select('id')
      .in('id', preferredIds)
      .eq('is_active', true)

    for (const r of (resourceRows ?? [])) validPreferredIds.add(r.id as string)
  }

  // Валидация филиала + enforcement per_branch режима.
  if (branchId) {
    const { data: branchRow } = await db
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .maybeSingle()
    if (!branchRow) {
      throw createError({ statusCode: 400, message: 'Указанный филиал не найден в этом тенанте' })
    }
  } else {
    const { data: tenantRow } = await db
      .from('tenants')
      .select('branch_selection_mode')
      .maybeSingle()
    if (tenantRow?.branch_selection_mode === 'per_branch') {
      const { count } = await db.from('branches').select('id', { count: 'exact', head: true })
      if ((count ?? 0) > 1) {
        throw createError({ statusCode: 400, message: 'Выберите филиал для записи' })
      }
    }
  }

  // Совместимость услуга↔филиал.
  if (branchId && serviceIds.length) {
    const { data: svcBranchRows } = await db
      .junction('service_branches')
      .select('service_id, branch_id')
      .in('service_id', serviceIds)

    const allowedByService = new Map<string, Set<string>>()
    for (const row of (svcBranchRows ?? []) as Array<{ service_id: string; branch_id: string }>) {
      const set = allowedByService.get(row.service_id) ?? new Set<string>()
      set.add(row.branch_id)
      allowedByService.set(row.service_id, set)
    }
    for (const sid of serviceIds) {
      const allowed = allowedByService.get(sid)
      if (allowed && allowed.size > 0 && !allowed.has(branchId)) {
        const svc = serviceById.get(sid)!
        throw createError({
          statusCode: 400,
          message: `Услуга "${svc.name}" недоступна в выбранном филиале`,
        })
      }
    }
  }

  // Совместимость preferred-мастер↔филиал.
  if (branchId && validPreferredIds.size > 0) {
    const ids = Array.from(validPreferredIds)
    const { data: rb } = await db
      .junction('resource_branches')
      .select('resource_id, branch_id')
      .in('resource_id', ids)
    const branchesByResource = new Map<string, Set<string>>()
    for (const row of (rb ?? []) as Array<{ resource_id: string; branch_id: string }>) {
      const set = branchesByResource.get(row.resource_id) ?? new Set<string>()
      set.add(row.branch_id)
      branchesByResource.set(row.resource_id, set)
    }
    for (const rid of ids) {
      const allowed = branchesByResource.get(rid)
      if (allowed && allowed.size > 0 && !allowed.has(branchId)) {
        // Не валим всю заявку — просто сбрасываем preferred (это soft-предпочтение).
        validPreferredIds.delete(rid)
      }
    }
  }

  // Формируем services для INSERT
  const servicesPayload = rawServices.map((s) => {
    const svc = serviceById.get(s.serviceId as string)!
    const preferred = s.preferredResourceId && validPreferredIds.has(s.preferredResourceId)
      ? s.preferredResourceId
      : null
    return {
      service_id: svc.id,
      service_name: svc.name,
      preferred_resource_id: preferred,
      duration_minutes: svc.duration,
      price: svc.price,
    }
  })

  // После 230 заявка — это визит со status='request' (отдельной таблицы нет).
  // RPC create_visit_request инкапсулирует INSERT.
  const { data: rpcRow, error: rpcError } = await db.raw.rpc('create_visit_request', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_customer_id: customerId,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_customer_email: customerEmail,
    p_notes: notes,
    p_requested_services: servicesPayload,
  })

  if (rpcError) {
    reportError(rpcError)
    throw createError({ statusCode: 500, message: 'Не удалось сохранить заявку' })
  }

  return { id: (rpcRow as { id: string }).id }
})
