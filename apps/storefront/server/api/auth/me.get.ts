import { getCookie } from 'h3'
import { getAuthSupabase } from '../../utils/supabase'
import { getAuthenticatedContextWithCustomer } from '../../utils/customerAuth'
import { ensureCustomer } from '../../utils/authHelpers'
import { TG_SESSION_COOKIE_NAME } from '../../utils/telegramAuth'

// Two auth paths diverge here on purpose:
//   - TG sessions are pre-created in /api/auth/telegram/login, so we just resolve them.
//   - Email/password sessions need ensureCustomer() to lazily create the customer row on
//     first /me call after Supabase signup (the auth user exists, the customer doesn't).
export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  if (getCookie(event, TG_SESSION_COOKIE_NAME)) {
    const { customer } = await getAuthenticatedContextWithCustomer(event)
    return { customer }
  }

  const authHeader = getRequestHeader(event, 'authorization')
  if (!authHeader) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const supabase = getAuthSupabase(authHeader)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw createError({ statusCode: 401, message: 'Сессия истекла' })

  const customer = await ensureCustomer(tenantId, user.id, {
    email: user.email,
    name: user.user_metadata?.name,
    avatarUrl: user.user_metadata?.avatar_url,
  })

  return { customer }
})
