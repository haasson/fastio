import { createError } from 'h3'

import { reportError } from '@fastio/shared/observability'

import type { ResolvedItem } from './types'

/**
 * Превращает ResolvedItem[] в payload для RPC `create_appointments_bulk`.
 * RPC ожидает snake_case + resource_assigned_by ('client' | 'auto').
 */
export function toRpcItems(resolvedItems: ResolvedItem[]) {
  return resolvedItems.map((it) => ({
    service_id: it.serviceId,
    resource_id: it.resourceId,
    starts_at: it.startsAt,
    ends_at: it.endsAt,
    service_name: it.serviceName,
    service_price: it.servicePrice,
    resource_assigned_by: it.assignedBy,
  }))
}

/**
 * Превращает Postgres-ошибку RPC `create_appointments_bulk` в createError.
 *  - P0002 или message 'Slot is taken' → 409 «Время уже занято».
 *  - P0001 → 400 с message из RPC.
 *  - всё прочее → 500 + reportError в Sentry.
 *
 * Никогда не возвращает — всегда бросает.
 */
export function throwRpcError(error: unknown): never {
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
