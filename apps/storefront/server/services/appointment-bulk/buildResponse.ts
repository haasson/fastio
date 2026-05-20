import type { IdempotentResponse, TenantDb } from './types'

/**
 * Собирает IdempotentResponse из строк appointment_groups → appointments по group_id.
 * Используется и для idempotency-кеша (по существующему ключу), и для финальной
 * сборки ответа после успешного RPC `create_appointments_bulk`.
 */
export async function buildResponseFromGroup(
  db: TenantDb,
  groupId: string,
): Promise<IdempotentResponse | null> {
  const { data: rows } = await db
    .from('appointments')
    .select('id, service_id, starts_at, ends_at')
    .eq('group_id', groupId)
    .order('starts_at')

  if (!rows || rows.length === 0) return null

  return {
    visitId: groupId,
    appointments: rows.map((r) => ({
      id: r.id as string,
      serviceId: r.service_id as string,
      startsAt: r.starts_at as string,
      endsAt: r.ends_at as string,
    })),
  }
}
