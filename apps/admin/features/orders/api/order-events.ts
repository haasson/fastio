import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrderEvent } from '@fastio/shared'
import { query } from '~/utils/query'
import type { OrderEventRow } from '~/utils/api/db-types'

export type AddOrderEventParams = Omit<OrderEvent, 'id' | 'createdAt'>

export const mapOrderEvent = (raw: Record<string, unknown>): OrderEvent => {
  const row = raw as OrderEventRow

  return {
    id: row.id,
    orderId: row.order_id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    eventType: row.event_type as OrderEvent['eventType'],
    meta: row.meta,
    createdAt: row.created_at,
  }
}

export const orderEventsApi = {
  async list(sb: SupabaseClient, orderId: string): Promise<OrderEvent[]> {
    const data = await query(
      sb.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
    )

    return (data ?? []).map(mapOrderEvent)
  },

  async add(sb: SupabaseClient, params: AddOrderEventParams): Promise<OrderEvent | null> {
    const result = await query(
      sb.from('order_events').insert({
        order_id: params.orderId,
        tenant_id: params.tenantId,
        actor_id: params.actorId,
        actor_name: params.actorName,
        actor_role: params.actorRole,
        event_type: params.eventType,
        meta: params.meta,
      }).select().single(),
    )

    return result ? mapOrderEvent(result) : null
  },
}
