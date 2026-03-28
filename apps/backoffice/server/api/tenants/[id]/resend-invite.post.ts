import { defineEventHandler, createError, getRouterParam } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getAdminClient } from '../../../utils/adminClient'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) throw createError({ statusCode: 400, message: 'id required' })

  const supabase = getAdminClient()

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('owner_id')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) throw createError({ statusCode: 404, message: 'Тенант не найден' })

  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(tenant.owner_id)

  if (userError || !user) throw createError({ statusCode: 404, message: 'Пользователь не найден' })
  if (user.email_confirmed_at) throw createError({ statusCode: 409, message: 'Пользователь уже активирован' })

  const config = useRuntimeConfig()
  const { error } = await supabase.auth.admin.inviteUserByEmail(user.email!, {
    redirectTo: `${config.adminUrl}/set-password`,
  })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { success: true }
})
