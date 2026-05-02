import { mapDeliveryZoneRow } from '../utils/supabase'
import { getTenantDb } from '../utils/tenantDb'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const { data: activeBranches } = await db
    .from('branches')
    .select('id')
    .eq('is_active', true)
    .is('archived_at', null)

  const activeBranchIds = (activeBranches ?? []).map((b) => b.id)
  if (activeBranchIds.length === 0) return []

  const { data: rows, error } = await db
    .from('delivery_zones')
    .select('*')
    .eq('is_active', true)
    .in('branch_id', activeBranchIds)
    .order('sort_order')

  if (error) throw createError({ statusCode: 500, message: error.message })

  return (rows ?? []).map(mapDeliveryZoneRow)
})
