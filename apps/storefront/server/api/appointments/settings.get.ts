import { getServerSupabase } from '../../utils/supabase'
import type { AppointmentSettings } from '@fastio/shared'
import { mapAppointmentSettings } from '@fastio/shared'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const supabase = getServerSupabase()

  const { data } = await supabase
    .from('appointment_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data) {
    return {
      resourceLabel: 'Исполнитель',
      staffNameFormat: 'full_name',
      autoConfirm: false,
      bookingHorizonDays: 30,
      slotStepMinutes: 30,
      allowClientCancellation: true,
      cancellationDeadlineHours: 2,
    } satisfies Partial<AppointmentSettings>
  }

  return mapAppointmentSettings(data as Record<string, unknown>)
})
