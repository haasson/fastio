import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppointmentSettings, AppointmentResourceMode, BookingMode, StaffNameFormat } from '@fastio/shared'
import { mapAppointmentSettings } from '@fastio/shared'
import type { AppointmentSettingsRow } from '~/shared/data/db-types'
import { query } from '~/shared/utils/query'

export type AppointmentSettingsFormData = {
  resourceLabel?: string
  resourceMode?: AppointmentResourceMode
  staffNameFormat?: StaffNameFormat
  autoConfirm?: boolean
  bookingHorizonDays?: number
  slotStepMinutes?: number
  allowClientCancellation?: boolean
  allowClientReschedule?: boolean
  cancellationDeadlineHours?: number
  defaultIsBookable?: boolean
  defaultBookingMode?: BookingMode
  defaultAllowResourceChoice?: boolean
  defaultMaxDuration?: number
}

export const appointmentSettingsApi = {
  async get(sb: SupabaseClient, tenantId: string): Promise<AppointmentSettings | null> {
    const { data, error } = await sb
      .from('appointment_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) throw new Error(error.message)

    return data ? mapAppointmentSettings(data as unknown as AppointmentSettingsRow) : null
  },

  async upsert(sb: SupabaseClient, tenantId: string, form: AppointmentSettingsFormData): Promise<AppointmentSettings> {
    const payload: Record<string, unknown> = { tenant_id: tenantId }

    if (form.resourceLabel !== undefined) payload.resource_label = form.resourceLabel
    if (form.resourceMode !== undefined) payload.resource_mode = form.resourceMode
    if (form.staffNameFormat !== undefined) payload.staff_name_format = form.staffNameFormat
    if (form.autoConfirm !== undefined) payload.auto_confirm = form.autoConfirm
    if (form.bookingHorizonDays !== undefined) payload.booking_horizon_days = form.bookingHorizonDays
    if (form.slotStepMinutes !== undefined) payload.slot_step_minutes = form.slotStepMinutes
    if (form.allowClientCancellation !== undefined) payload.allow_client_cancellation = form.allowClientCancellation
    if (form.allowClientReschedule !== undefined) payload.allow_client_reschedule = form.allowClientReschedule
    if (form.cancellationDeadlineHours !== undefined) payload.cancellation_deadline_hours = form.cancellationDeadlineHours
    if (form.defaultIsBookable !== undefined) payload.default_is_bookable = form.defaultIsBookable
    if (form.defaultBookingMode !== undefined) payload.default_booking_mode = form.defaultBookingMode
    if (form.defaultAllowResourceChoice !== undefined) payload.default_allow_resource_choice = form.defaultAllowResourceChoice
    if (form.defaultMaxDuration !== undefined) payload.default_max_duration = form.defaultMaxDuration

    const result = await query(
      sb.from('appointment_settings')
        .upsert(payload, { onConflict: 'tenant_id' })
        .select('*')
        .single(),
    )

    return mapAppointmentSettings(result as unknown as AppointmentSettingsRow)
  },
}
