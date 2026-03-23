import { getAuthSupabase } from '../../utils/supabase'
import { ensureCustomer } from '../../utils/authHelpers'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const authHeader = getRequestHeader(event, 'authorization')
  if (!authHeader) {
    throw createError({ statusCode: 401, message: 'Не авторизован' })
  }

  const supabase = getAuthSupabase(authHeader)

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw createError({ statusCode: 401, message: 'Сессия истекла' })
  }

  const customer = await ensureCustomer(tenantId, user.id, {
    email: user.email,
    name: user.user_metadata?.name,
    avatarUrl: user.user_metadata?.avatar_url,
  })

  return { customer }
})
