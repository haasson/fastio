import { defineEventHandler, createError, getRouterParam } from 'h3'
import { getAdminClient } from '../../utils/adminClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing tenant id' })

  const supabase = getAdminClient()

  // Get owner_id before deleting
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (tenantError) throw createError({ statusCode: 500, message: tenantError.message })
  if (!tenant) throw createError({ statusCode: 404, message: 'Tenant not found' })

  const ownerId = tenant.owner_id

  // Delete tenant (cascade handles related records)
  const { error: deleteError } = await supabase.from('tenants').delete().eq('id', id)

  if (deleteError) throw createError({ statusCode: 500, message: deleteError.message })

  // Check if owner has other tenants — if not, delete auth user so email can be reused
  const { data: otherTenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', ownerId)
    .limit(1)

  if (!otherTenants || otherTenants.length === 0) {
    await supabase.auth.admin.deleteUser(ownerId)
  }

  return { ok: true }
})
