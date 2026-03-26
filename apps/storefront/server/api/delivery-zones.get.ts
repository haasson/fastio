import { getServerSupabase, mapDeliveryZoneRow } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const supabase = getServerSupabase()

  const { data: activeBranches } = await supabase
    .from('branches')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('archived_at', null)

  const activeBranchIds = (activeBranches ?? []).map((b) => b.id)
  if (activeBranchIds.length === 0) return []

  const { data: rows, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('branch_id', activeBranchIds)
    .order('sort_order')

  if (error) throw createError({ statusCode: 500, message: error.message })

  return (rows ?? []).map(mapDeliveryZoneRow)
})
