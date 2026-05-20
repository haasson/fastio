import { createError } from 'h3'

import {
  DEFAULT_APPOINTMENT_SETTINGS,
  DEFAULT_TIMEZONE,
  addDaysToDateStr,
  todayInTz,
  validateAndNormalizeRussianPhone,
} from '@fastio/shared'

import type { BulkItem, BulkPayload, ServiceRow, TenantDb } from './types'

const NOTES_MAX_LENGTH = 1000

/**
 * Валидирует body запроса (имя, телефон, дата, items) до DB-запросов.
 * Возвращает нормализованный phone (+E.164 RU). Бросает 400 при любом нарушении.
 */
export function validateBody(body: BulkPayload): { normalizedPhone: string } {
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
  for (const item of body.items) {
    if (!item.serviceId || typeof item.serviceId !== 'string') {
      throw createError({ statusCode: 400, message: 'Каждый элемент должен содержать serviceId' })
    }
    // resourceId может быть null — это «любой исполнитель», бэк подберёт сам.
    if (!item.startTime || !/^\d{2}:\d{2}$/.test(item.startTime)) {
      throw createError({ statusCode: 400, message: 'Каждый элемент должен содержать startTime (HH:MM)' })
    }
  }
  if (body.branchId !== null && body.branchId !== undefined && typeof body.branchId !== 'string') {
    throw createError({ statusCode: 400, message: 'Некорректный идентификатор филиала' })
  }

  return { normalizedPhone }
}

export type TenantContext = {
  tz: string
  todayStr: string
  autoConfirm: boolean
  horizon: number
  allowReschedule: boolean
  allowCancel: boolean
  branchSelectionMode: string | null
}

/**
 * Загружает настройки тенанта и appointment_settings, валидирует:
 *  - модуль services включён
 *  - дата не в прошлом
 *  - дата внутри booking_horizon_days
 *
 * Возвращает контекст для дальнейших шагов.
 */
export async function loadTenantContext(
  db: TenantDb,
  body: BulkPayload,
): Promise<TenantContext> {
  const { data: tenantData } = await db
    .from('tenants')
    .select('modules, timezone, branch_selection_mode')
    .single()

  if (!tenantData?.modules?.services) {
    throw createError({ statusCode: 400, message: 'Онлайн-запись недоступна' })
  }

  const tz = (tenantData.timezone as string) ?? DEFAULT_TIMEZONE
  const todayStr = todayInTz(tz)

  if (body.date < todayStr) {
    throw createError({ statusCode: 400, message: 'Нельзя выбрать прошедшую дату' })
  }

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

  return {
    tz,
    todayStr,
    autoConfirm,
    horizon,
    allowReschedule,
    allowCancel,
    branchSelectionMode: (tenantData.branch_selection_mode as string | null) ?? null,
  }
}

/**
 * Проверяет branchId на принадлежность тенанту + per_branch-mode (если включён,
 * branch обязателен при >1 филиалов).
 */
export async function validateBranch(
  db: TenantDb,
  branchId: string | null,
  branchSelectionMode: string | null,
): Promise<void> {
  if (branchId) {
    const { data: branchRow } = await db
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .maybeSingle()
    if (!branchRow) {
      throw createError({ statusCode: 400, message: 'Указанный филиал не найден в этом тенанте' })
    }
    return
  }

  if (branchSelectionMode === 'per_branch') {
    // В per_branch-режиме записи без филиала не допускаются — это означает
    // что клиент пробрасывает старый branchId=null (legacy) или модалка
    // выбора филиала почему-то не сработала. Создавать «безфилиальную» запись
    // нельзя: она невидима для админского sidebar-фильтра.
    const { count } = await db.from('branches').select('id', { count: 'exact', head: true })
    if ((count ?? 0) > 1) {
      throw createError({ statusCode: 400, message: 'Выберите филиал для записи' })
    }
  }
}

/**
 * Загружает услуги (с фильтрацией по тенанту через TenantDb) и
 * валидирует: каждая из items.serviceId существует, bookable, имеет
 * допустимую длительность (< 1440).
 */
export async function loadAndValidateServices(
  db: TenantDb,
  items: BulkItem[],
): Promise<{ serviceById: Map<string, ServiceRow>; serviceIds: string[] }> {
  const serviceIds = [...new Set(items.map((i) => i.serviceId))]

  const { data: servicesData } = await db
    .from('services')
    .select('id, duration, is_bookable, name, price, category_id')
    .in('id', serviceIds)

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

  return { serviceById, serviceIds }
}

/**
 * Совместимость услуга↔филиал: пустой список service_branches = «во всех филиалах»;
 * непустой и не содержащий branchId = услуга в этом филиале не оказывается.
 */
export async function validateServiceBranches(
  db: TenantDb,
  branchId: string | null,
  serviceIds: string[],
  serviceById: Map<string, ServiceRow>,
): Promise<void> {
  if (!branchId || !serviceIds.length) return

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

/**
 * Валидирует явно указанных мастеров: tenant-membership + is_active +
 * совместимость с услугой (либо service_resources, либо resource_categories) +
 * совместимость с филиалом.
 */
export async function validateExplicitResources(
  db: TenantDb,
  items: BulkItem[],
  serviceIds: string[],
  serviceById: Map<string, ServiceRow>,
  branchId: string | null,
): Promise<void> {
  // Только для items с явно заданным мастером — для них валидируем
  // тенант/компетенции. Items с null собираются отдельно в resolveItems
  // и для каждого бэк сам подбирает кандидата.
  //
  // ВАЖНО: запросы выполняем всегда (даже если resourceIds пустой). Это сохраняет
  // sequential порядок DB-вызовов для bulk.post.test.ts, где autoPath-хелпер
  // явно мочит [explicit-call, auto-call] через массивный resolver.
  const resourceIds = [...new Set(items.map((i) => i.resourceId).filter((r): r is string => r !== null))]

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

  // Совместимость мастер↔филиал для явно выбранных мастеров.
  // resource_branches пустой = мастер работает во всех филиалах.
  if (branchId) {
    const { data: explicitResourceBranchRows } = await db
      .junction('resource_branches')
      .select('resource_id, branch_id')
      .in('resource_id', resourceIds)

    const branchesByResource = new Map<string, Set<string>>()
    for (const row of (explicitResourceBranchRows ?? []) as Array<{ resource_id: string; branch_id: string }>) {
      const set = branchesByResource.get(row.resource_id) ?? new Set<string>()
      set.add(row.branch_id)
      branchesByResource.set(row.resource_id, set)
    }
    for (const rid of resourceIds) {
      const allowed = branchesByResource.get(rid)
      if (allowed && allowed.size > 0 && !allowed.has(branchId)) {
        throw createError({
          statusCode: 400,
          message: 'Выбранный мастер не работает в этом филиале',
        })
      }
    }
  }
}
