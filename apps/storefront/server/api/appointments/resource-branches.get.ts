import { createRateLimiter } from '@fastio/shared'
import { getTenantDb } from '../../utils/tenantDb'

const MAX_IDS = 200
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const rateLimiter = createRateLimiter(30, 60_000)

/**
 * Возвращает branchIds для списка ресурсов: { [resourceId]: branchIds[] }.
 * Пустой массив = ресурс доступен во всех филиалах.
 *
 * Используется при смене филиала в шапке storefront, чтобы точно показать
 * клиенту, у каких услуг сбросится выбранный мастер.
 */
export default defineEventHandler(async (event): Promise<Record<string, string[]>> => {
  const db = getTenantDb(event)

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const query = getQuery(event)
  const idsParam = query.ids as string | undefined

  if (!idsParam) return {}

  const rawIds = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
  if (rawIds.length === 0) return {}
  if (rawIds.length > MAX_IDS) {
    throw createError({ statusCode: 400, statusMessage: `Too many ids (max ${MAX_IDS})` })
  }
  const ids = rawIds.filter((id) => UUID_REGEX.test(id))
  if (ids.length === 0) return {}

  // Cross-tenant guard: junction-таблица не имеет tenant_id, поэтому фильтруем
  // resource_id'ы через `resources` (которая инжектит tenant_id автоматически).
  const { data: tenantResources } = await db
    .from('resources')
    .select('id')
    .in('id', ids)

  const allowedIds = new Set((tenantResources ?? []).map((r) => r.id as string))
  if (allowedIds.size === 0) return {}

  const safeIds = ids.filter((id) => allowedIds.has(id))

  const { data } = await db
    .junction('resource_branches')
    .select('resource_id, branch_id')
    .in('resource_id', safeIds)

  const result: Record<string, string[]> = {}
  for (const id of safeIds) result[id] = []

  for (const row of (data ?? []) as Array<{ resource_id: string; branch_id: string }>) {
    if (!result[row.resource_id]) result[row.resource_id] = []
    result[row.resource_id].push(row.branch_id)
  }

  return result
})
