import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppointmentEvent } from '@fastio/shared'
import type { AppointmentEventRow } from '~/utils/api/db-types'
import { query } from '~/utils/query'

export type AddAppointmentEventParams = Omit<AppointmentEvent, 'id' | 'createdAt'>

export const mapAppointmentEvent = (input: Record<string, unknown>): AppointmentEvent => {
  const raw = input as unknown as AppointmentEventRow

  return {
    id: raw.id,
    appointmentId: raw.appointment_id,
    tenantId: raw.tenant_id,
    actorId: raw.actor_id ?? null,
    actorName: raw.actor_name ?? null,
    actorRole: raw.actor_role ?? null,
    eventType: raw.event_type,
    meta: raw.meta ?? {},
    createdAt: raw.created_at,
  }
}

export const appointmentEventsApi = {
  async list(sb: SupabaseClient, appointmentId: string): Promise<AppointmentEvent[]> {
    const data = await query(
      sb.from('appointment_events').select('*').eq('appointment_id', appointmentId).order('created_at', { ascending: true }),
    )

    return (data ?? []).map((r) => mapAppointmentEvent(r as Record<string, unknown>))
  },

  async add(sb: SupabaseClient, params: AddAppointmentEventParams): Promise<AppointmentEvent | null> {
    const result = await query(
      sb.from('appointment_events').insert({
        appointment_id: params.appointmentId,
        tenant_id: params.tenantId,
        actor_id: params.actorId,
        actor_name: params.actorName,
        actor_role: params.actorRole,
        event_type: params.eventType,
        meta: params.meta,
      }).select().single(),
    )

    return result ? mapAppointmentEvent(result as Record<string, unknown>) : null
  },
}
