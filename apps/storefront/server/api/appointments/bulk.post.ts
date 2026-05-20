import { reportError } from '@fastio/shared/observability'
import { getClientIp } from '@fastio/shared/server'

import { getAuthenticatedContextWithCustomer } from '../../utils/customerAuth'
import { enforceRateLimit } from '../../utils/enforceRateLimit'
import { getTenantDb } from '../../utils/tenantDb'
import {
  attachIdempotencyKey,
  autoPickResources,
  computeResolvedItems,
  findCachedResponse,
  loadAndValidateServices,
  loadTenantContext,
  parseIdempotencyKey,
  throwRpcError,
  toRpcItems,
  validateBody,
  validateBranch,
  validateExplicitResources,
  validateServiceBranches,
} from '../../services/appointment-bulk'

import type { BulkPayload, BulkRpcResult } from '../../services/appointment-bulk'

// Публичные типы request payload — внешний контракт для checkout.
export type { BulkItem, BulkPayload } from '../../services/appointment-bulk'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const { tenantId } = db

  const ip = getClientIp(event)
  await enforceRateLimit(
    [{ key: `appointments-bulk:tenant-ip:${tenantId}:${ip}`, max: 5, windowSeconds: 60 }],
    'Слишком много запросов. Попробуйте позже.',
  )

  const idempotencyKey = parseIdempotencyKey(getRequestHeader(event, 'idempotency-key'))
  if (idempotencyKey) {
    const cached = await findCachedResponse(db, idempotencyKey)
    if (cached) return cached
  }

  const body = await readBody<BulkPayload>(event)
  const { normalizedPhone } = validateBody(body)
  const tenantCtx = await loadTenantContext(db, body)

  const branchId: string | null = body.branchId ?? null
  await validateBranch(db, branchId, tenantCtx.branchSelectionMode)

  const items = body.items
  const { serviceById, serviceIds } = await loadAndValidateServices(db, items)
  await validateServiceBranches(db, branchId, serviceIds, serviceById)
  await validateExplicitResources(db, items, serviceIds, serviceById, branchId)

  const resolvedItems = computeResolvedItems(items, body.date, tenantCtx.tz, serviceById)
  await autoPickResources(db, resolvedItems, body.date, tenantCtx.tz, branchId, serviceById)

  // Определяем userId и customerId. Гость: оба null. Поддерживаем Bearer JWT и Telegram-куку.
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

  // Атомарная вставка через RPC: advisory_xact_lock per resource + capacity checks
  // + INSERT'ы. Либо всё ок, либо ничего не записано.
  // Audit-event 'group_created' пока не пишется — см. TECHDEBT.md.
  const { data: rpcResult, error } = await db.raw.rpc('create_appointments_bulk', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
    p_user_id: userId,
    p_customer_id: customerId,
    p_customer_name: body.customerName.trim(),
    p_customer_phone: normalizedPhone,
    p_customer_email: body.customerEmail?.trim() || null,
    p_status: tenantCtx.autoConfirm ? 'confirmed' : 'new',
    p_notes: body.notes?.trim() || null,
    p_allow_reschedule_snapshot: tenantCtx.allowReschedule,
    p_allow_cancel_snapshot: tenantCtx.allowCancel,
    p_source: 'storefront',
    p_items: toRpcItems(resolvedItems),
  })

  if (error) throwRpcError(error)

  const parsed = rpcResult as BulkRpcResult | null
  if (!parsed?.appointments?.length) {
    reportError(new Error('[bulk] RPC returned unexpected result'))
    throw createError({ statusCode: 500, message: 'Не удалось создать запись' })
  }

  if (idempotencyKey) {
    const silentTwin = await attachIdempotencyKey(db, parsed.group_id, idempotencyKey)
    if (silentTwin) return silentTwin
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
