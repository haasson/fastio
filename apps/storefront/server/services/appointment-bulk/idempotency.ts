import { createError } from 'h3'

import { reportError } from '@fastio/shared/observability'

import { buildResponseFromGroup } from './buildResponse'

import type { IdempotentResponse, TenantDb } from './types'

const IDEMPOTENCY_KEY_MAX_LENGTH = 128
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]+$/

/**
 * Парсит заголовок Idempotency-Key, валидирует (длина/паттерн).
 * Возвращает null если заголовка нет.
 */
export function parseIdempotencyKey(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? null
  if (!trimmed) return null

  if (trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH || !IDEMPOTENCY_KEY_PATTERN.test(trimmed)) {
    throw createError({ statusCode: 400, message: 'Некорректный Idempotency-Key' })
  }

  return trimmed
}

/**
 * Если по этому idempotency_key уже есть appointment_groups — возвращает
 * закешированный ответ (тот же группа+appointments). Иначе null.
 */
export async function findCachedResponse(
  db: TenantDb,
  idempotencyKey: string,
): Promise<IdempotentResponse | null> {
  const { data: existingGroup } = await db
    .from('appointment_groups')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (!existingGroup) return null

  return buildResponseFromGroup(db, existingGroup.id as string)
}

/**
 * Сохраняет idempotency_key за созданной группой. При 23505 (race с параллельным
 * запросом, конкурент уже забрал ключ) отдаёт существующую группу как cached
 * response — «silent twin» лучше чем 500 для клиента: с его точки зрения
 * запись прошла. Прочие ошибки логирует в Sentry, но не падает.
 */
export async function attachIdempotencyKey(
  db: TenantDb,
  groupId: string,
  idempotencyKey: string,
): Promise<IdempotentResponse | null> {
  const { error: keyError } = await db
    .from('appointment_groups')
    .update({ idempotency_key: idempotencyKey })
    .eq('id', groupId)

  if (!keyError) return null

  if ((keyError as { code?: string }).code === '23505') {
    const { data: winner } = await db
      .from('appointment_groups')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (winner) return buildResponseFromGroup(db, winner.id as string)
    return null
  }

  reportError(keyError)
  return null
}
