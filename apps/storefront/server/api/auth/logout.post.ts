import { createClient } from '@supabase/supabase-js'
import { getCookie, deleteCookie } from 'h3'
import { getTenantDb } from '../../utils/tenantDb'
import { hashSessionToken, TG_SESSION_COOKIE_NAME } from '../../utils/telegramAuth'
import { reportError } from '~/shared/utils/reportError'

export default defineEventHandler(async (event) => {
  const cookieToken = getCookie(event, TG_SESSION_COOKIE_NAME)
  if (cookieToken) {
    const db = getTenantDb(event)
    // Filter by tenant_id (auto-applied) + token_hash — defence in depth
    // in case scopes ever get crossed (cookie from tenant A, request resolved to tenant B).
    const { error } = await db
      .from('customer_sessions')
      .delete()
      .eq('token_hash', hashSessionToken(cookieToken))
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
