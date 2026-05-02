import { getTenantDb } from '../../utils/tenantDb'
import type { AppointmentSettings } from '@fastio/shared'
import { mapAppointmentSettings } from '@fastio/shared'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const { data } = await db
    .from('appointment_settings')
    .select('*')
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
