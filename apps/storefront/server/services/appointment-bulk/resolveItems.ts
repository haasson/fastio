import { createError } from 'h3'

import { addDaysToDateStr, localDateTimeToUtcIso } from '@fastio/shared'

import { createLocalBookings } from './reserveLocal'

import type { BulkItem, ResolvedItem, ServiceRow, TenantDb } from './types'

/**
 * Превращает входные items (resourceId возможно null) в ResolvedItem с
 * заполненными UTC-интервалами. resourceId оставляем как есть — auto-pick
 * происходит на следующем шаге.
 */
export function computeResolvedItems(
  items: BulkItem[],
  date: string,
  tz: string,
  serviceById: Map<string, ServiceRow>,
): ResolvedItem[] {
  return items.map((item) => {
    const svc = serviceById.get(item.serviceId)!
    const duration = svc.duration

    // overnight: если слот в фазе D+1, локальная дата старта = body.date+1.
    // duration < 1440 (валидация выше) ⇒ end может уехать максимум на +1 сутки
    // от startDate, две полуночи не пересекаются.
    const startDate = item.isNextDay ? addDaysToDateStr(date, 1) : date
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
      startsAt,
      endsAt,
      duration,
      serviceName: svc.name,
      servicePrice: svc.price,
      assignedBy: item.resourceId ? 'client' : 'auto',
    }
  })
}

/**
 * Авто-подбор исполнителя для items с resourceId=null («любой исполнитель»).
 *
 * Алгоритм:
 *  1. Собираем кандидатов из service_resources + resource_categories (через
 *     категорию услуги), фильтруем по is_active.
 *  2. Если задан branchId — отбрасываем мастеров, явно НЕ привязанных к
 *     этому филиалу (resource_branches пустой = «работает во всех»).
 *  3. Pre-фильтр отпусков/больничных через resource_unavailability на дату
 *     брони. Финальный инвариант гарантирует RPC через check_resource_unavailability.
 *  4. Round-robin: для каждого item выбираем кандидата с минимальной дневной
 *     нагрузкой (DB + локальный счётчик), исключая занятых в (startsAt, endsAt).
 *     Tiebreak — стабильный (по resource.id).
 *
 * Мутирует resolvedItems в месте: заполняет resourceId у items с assignedBy='auto'.
 */
export async function autoPickResources(
  db: TenantDb,
  resolvedItems: ResolvedItem[],
  date: string,
  tz: string,
  branchId: string | null,
  serviceById: Map<string, ServiceRow>,
): Promise<void> {
  const autoItems = resolvedItems.filter((it) => !it.resourceId)
  if (autoItems.length === 0) return

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

  // Текущий уникальный список кандидатов из всех сервис-сетов. Вычисляем на лету —
  // состав меняется после branch-фильтра и unavailability-фильтра.
  const currentCandidateIds = (): string[] => [...new Set(
    Array.from(candidatesByService.values()).flatMap((s) => Array.from(s)),
  )]

  // Если задан филиал — отбрасываем кандидатов, не привязанных к нему.
  if (branchId) {
    const allCandidateIds = currentCandidateIds()
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

  // Pre-фильтр для round-robin: исключаем мастеров в отпуске/больничном на дату
  // брони, чтобы не тратить запросы на conflict-check для заведомо неподходящих.
  // Финальный инвариант гарантирует RPC `create_appointments_bulk` через
  // `check_resource_unavailability` (миграция 257) — если между pre-фильтром
  // и RPC мастера успели поставить в отпуск, RPC откажет с P0001.
  const allCandidateIdsForUnavail = currentCandidateIds()

  if (allCandidateIdsForUnavail.length) {
    const { data: unavailRows } = await db
      .from('resource_unavailability')
      .select('resource_id')
      .in('resource_id', allCandidateIdsForUnavail)
      .lte('date_from', date)
      .gte('date_to', date)

    const unavailableIds = new Set(((unavailRows ?? []) as Array<{ resource_id: string }>).map((r) => r.resource_id))
    if (unavailableIds.size > 0) {
      for (const set of candidatesByService.values()) {
        for (const id of Array.from(set)) {
          if (unavailableIds.has(id)) set.delete(id)
        }
      }
    }
  }

  // Дневная нагрузка: COUNT по resource_id за весь календарный день.
  const dayStartUtc = localDateTimeToUtcIso(date, '00:00', tz)
  const dayEndUtc = localDateTimeToUtcIso(addDaysToDateStr(date, 1), '00:00', tz)

  const allCandIds = currentCandidateIds()
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

  const localBookings = createLocalBookings()

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
    const free = candidates.filter((id) => !busy.has(id) && !localBookings.hasOverlap(id, it.startsAt, it.endsAt))

    if (free.length === 0) {
      throw createError({
        statusCode: 409,
        message: `На время ${it.startTime} нет свободных исполнителей для "${it.serviceName}". Выберите другое время.`,
      })
    }

    // Round-robin: min нагрузки + стабильный порядок при равенстве.
    free.sort((a, b) => {
      const la = (loadByResource.get(a) ?? 0) + localBookings.count(a)
      const lb = (loadByResource.get(b) ?? 0) + localBookings.count(b)
      if (la !== lb) return la - lb

      return a < b ? -1 : 1
    })

    it.resourceId = free[0]
    localBookings.reserve(free[0], it.startsAt, it.endsAt)
  }
}
