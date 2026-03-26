import { getServerSupabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const supabase = getServerSupabase()

  const [{ data, error }, { data: tenantData }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, address, working_hours')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .is('archived_at', null)
      .order('created_at'),
    supabase
      .from('tenants')
      .select('working_hours')
      .eq('id', tenantId)
      .single(),
  ])

  if (error) throw createError({ statusCode: 500, message: error.message })

  const tenantWorkingHours = tenantData?.working_hours as string | null

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    workingHours: row.working_hours || tenantWorkingHours,
  }))
})
