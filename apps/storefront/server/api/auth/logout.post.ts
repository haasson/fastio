import { createClient } from '@supabase/supabase-js'
import { getCookie, deleteCookie } from 'h3'
import { getServerSupabase } from '../../utils/supabase'
import { hashSessionToken, TG_SESSION_COOKIE_NAME } from '../../utils/telegramAuth'
import { reportError } from '~/utils/reportError'

export default defineEventHandler(async (event) => {
  const cookieToken = getCookie(event, TG_SESSION_COOKIE_NAME)
  if (cookieToken) {
    const tenantId = event.context.tenantId as string | undefined
    const supabase = getServerSupabase()
    // Filter by tenant_id in addition to the (already unique) token_hash — defence in depth
    // in case scopes ever get crossed (cookie from tenant A, request resolved to tenant B).
    let query = supabase
      .from('customer_sessions')
      .delete()
      .eq('token_hash', hashSessionToken(cookieToken))
    if (tenantId) query = query.eq('tenant_id', tenantId)
    const { error } = await query
    if (error) reportError(error)

    deleteCookie(event, TG_SESSION_COOKIE_NAME, { path: '/' })
  }

  const body = await readBody(event).catch(() => ({}))
  const accessToken = body?.accessToken

  if (accessToken) {
    const config = useRuntimeConfig()
    const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    await supabase.auth.signOut()
  }

  return { ok: true }
})
