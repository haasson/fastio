import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppointmentEvent } from '@fastio/shared'
import { mapAppointmentEvent } from '@fastio/shared'
import { query } from '~/utils/query'

export type AddAppointmentEventParams = Omit<AppointmentEvent, 'id' | 'createdAt'>

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
