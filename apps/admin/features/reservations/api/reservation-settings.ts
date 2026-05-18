import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReservationSettings, ReservationSettingsFormData } from '@fastio/shared'
import { query } from '~/shared/utils/query'

const mapSettings = (raw: Record<string, unknown>): ReservationSettings => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  enabled: raw.enabled as boolean,
  slotStep: raw.slot_step as number,
  closeBufferMinutes: (raw.close_buffer_minutes as number) ?? 60,
  maxAdvanceDays: raw.max_advance_days as number,
  minGuests: raw.min_guests as number,
  maxGuests: raw.max_guests as number,
  maxGuestsAuto: (raw.max_guests_auto as boolean) ?? false,
  autoConfirm: raw.auto_confirm as boolean,
  allowClientCancellation: (raw.allow_client_cancellation as boolean) ?? true,
})

export const reservationSettingsApi = {
  async get(sb: SupabaseClient, tenantId: string): Promise<ReservationSettings | null> {
    const { data, error } = await sb
      .from('reservation_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) {
      console.error('[reservation_settings.get]', error.message)

      return null
    }

    return data ? mapSettings(data) : null
  },

  async upsert(sb: SupabaseClient, tenantId: string, data: ReservationSettingsFormData): Promise<ReservationSettings> {
    const payload: Record<string, unknown> = { tenant_id: tenantId }

    if (data.enabled !== undefined) payload.enabled = data.enabled
    if (data.slotStep !== undefined) payload.slot_step = data.slotStep
    if (data.closeBufferMinutes !== undefined) payload.close_buffer_minutes = data.closeBufferMinutes
    if (data.maxAdvanceDays !== undefined) payload.max_advance_days = data.maxAdvanceDays
    if (data.minGuests !== undefined) payload.min_guests = data.minGuests
    if (data.maxGuests !== undefined) payload.max_guests = data.maxGuests
    if (data.maxGuestsAuto !== undefined) payload.max_guests_auto = data.maxGuestsAuto
    if (data.autoConfirm !== undefined) payload.auto_confirm = data.autoConfirm
    if (data.allowClientCancellation !== undefined) payload.allow_client_cancellation = data.allowClientCancellation

    const result = await query(
      sb.from('reservation_settings').upsert(payload, { onConflict: 'tenant_id' }).select('*').single(),
    )

    if (!result) throw new Error('[reservationSettings.upsert] no data returned')

    return mapSettings(result)
  },
}
