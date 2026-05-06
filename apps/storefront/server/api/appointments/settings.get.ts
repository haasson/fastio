import { getTenantDb } from '../../utils/tenantDb'
import type { AppointmentSettings } from '@fastio/shared'
import { DEFAULT_APPOINTMENT_SETTINGS, mapAppointmentSettings } from '@fastio/shared'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const { data } = await db
    .from('appointment_settings')
    .select('*')
    .maybeSingle()

  if (!data) return { ...DEFAULT_APPOINTMENT_SETTINGS } satisfies Partial<AppointmentSettings>

  return mapAppointmentSettings(data as Record<string, unknown>)
})
