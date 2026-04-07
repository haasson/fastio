import { getServerSupabase } from '../utils/supabase'
import type { WorkingHoursSchedule } from '@fastio/shared'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

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
    address: row.address,
    phone: row.phone,
    workingHoursSchedule: (row.working_hours_schedule as WorkingHoursSchedule | null) ?? null,
  }))
})
