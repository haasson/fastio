import { getServerSupabase } from '../utils/supabase'
import type { Tenant, WorkingHoursSchedule } from '@fastio/shared'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string
  const tenant = event.context.tenant as Tenant

  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('branches')
    .select('id, name, address, phone, working_hours_schedule')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('archived_at', null)
    .order('created_at')

  if (error) throw createError({ statusCode: 500, message: error.message })

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address ?? tenant.contacts?.address ?? null,
    phone: row.phone ?? tenant.contacts?.phone ?? null,
    workingHoursSchedule: (row.working_hours_schedule as WorkingHoursSchedule | null) ?? tenant.workingHoursSchedule ?? null,
  }))
})
