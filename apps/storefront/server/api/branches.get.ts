import { getTenantDb } from '../utils/tenantDb'
import type { BranchAddressData, BranchPublic, Tenant, WorkingHoursSchedule } from '@fastio/shared'

export default defineEventHandler(async (event): Promise<BranchPublic[]> => {
  const db = getTenantDb(event)
  const tenant = event.context.tenant as Tenant

  const { data, error } = await db
    .from('branches')
    .select('id, name, address, address_data, phone, working_hours_schedule')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('created_at')

  if (error) throw createError({ statusCode: 500, message: error.message })

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    address: row.address as string,
    addressData: row.address_data as BranchAddressData,
    phone: (row.phone as string | null) ?? tenant.contacts?.phone ?? null,
    workingHoursSchedule: (row.working_hours_schedule as WorkingHoursSchedule | null) ?? tenant.workingHoursSchedule ?? null,
  }))
})
