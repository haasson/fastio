import { createClient } from '@supabase/supabase-js'
import { captureException, withSentry } from '../_shared/sentry.ts'

// Унифицированный envelope ответа:
//   success: { success: true, email, roleName, tenantName, userExists }
//   error:   { success: false, error, code }
const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } })

const err = (status: number, code: string, error: string) =>
  json({ success: false, error, code }, { status })

// PREPROD-206: per-IP rate-limit 30/мин. Защищает от подбора `token` (UUID, но
// безопасности это не помешает) и общего spam'а. Read-only endpoint — fail-open
// при ошибке RPC (доступность важнее, иначе legit-юзер не примет инвайт).
const IP_LIMIT = { max: 30, windowSeconds: 60 }

function getClientIp(req: Request): string {
  // Приоритет: cf-connecting-ip (Cloudflare, клиент подделать не может) →
  // x-real-ip (Supabase Edge proxy) → x-forwarded-for[0]. Без них — 'unknown'
  // (бакет общий, IP-лимит вырождается в глобальный — fail-open принцип).
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf
  const real = req.headers.get('x-real-ip')
  if (real) return real
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown'
  return 'unknown'
}

Deno.serve(withSentry('get-invite', async (req) => {
  if (req.method !== 'POST') {
    return err(405, 'method_not_allowed', 'Method Not Allowed')
  }

  let payload: { token?: unknown }
  try {
    payload = await req.json()
  } catch {
    return err(400, 'invalid_body', 'Invalid JSON body')
  }

  const token = typeof payload.token === 'string' ? payload.token : ''
  if (!token) {
    return err(400, 'missing_fields', 'token is required')
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Rate-limit ДО лукапа в БД. На rl_error — fail-open (read-endpoint:
  // доступность важнее анти-абуза, legit-юзер должен иметь возможность
  // открыть страницу приглашения).
  const ip = getClientIp(req)
  const { data: rlAllowed, error: rlError } = await adminSupabase.rpc('consume_rate_limit', {
    _key: `get-invite:ip:${ip}`,
    _max: IP_LIMIT.max,
    _window_seconds: IP_LIMIT.windowSeconds,
  })

  if (rlError) {
    // Fail-open + log+Sentry для алёрта — массовый rl_error = поломка RPC/БД.
    console.error('[get-invite] consume_rate_limit failed:', rlError)
    captureException(rlError, { fn: 'get-invite', stage: 'rate-limit' })
  } else if (rlAllowed === false) {
    return err(429, 'rate_limited', 'Слишком много запросов. Попробуйте позже.')
  }

  const { data: invitation, error: inviteErr } = await adminSupabase
    .from('tenant_invitations')
    .select('email, role_id, expires_at, accepted_at, tenant_id, tenant_roles(name)')
    .eq('token', token)
    .single()

  if (inviteErr || !invitation) {
    // PGRST116 = no rows. Не считаем 404 ошибкой для Sentry-шума, но прочие
    // ошибки от БД — логируем.
    if (inviteErr && inviteErr.code !== 'PGRST116') {
      console.error('invitation lookup error:', inviteErr)
    }
    return err(404, 'not_found', 'Invitation not found')
  }

  if (invitation.accepted_at) {
    return err(409, 'already_accepted', 'Invitation already accepted')
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return err(410, 'expired', 'Invitation expired')
  }

  const roleData = (invitation as unknown as { tenant_roles?: { name: string } | null }).tenant_roles

  // Проверка существования юзера через SECURITY DEFINER RPC (миграция 169, get_user_id_by_email).
  // PostgREST на self-hosted не экспонирует схему `auth` (PGRST_DB_SCHEMAS=public,storage,graphql_public),
  // поэтому прямой `.schema('auth').from('users')` падал PGRST106 → 500 (user_lookup_failed) и ломал
  // весь invite-флоу. RPC обходит это, не открывая auth публичному ключу. Case-insensitive по email,
  // O(1) по индексу, без лимита 1000 у listUsers().
  const [tenantRes, userRes] = await Promise.all([
    adminSupabase
      .from('tenants')
      .select('name')
      .eq('id', invitation.tenant_id)
      .single(),
    adminSupabase.rpc('get_user_id_by_email', { p_email: invitation.email }),
  ])

  if (tenantRes.error) {
    // Не блокирующе — подставим пустое имя ниже. Логируем для Sentry.
    console.error('tenant lookup error:', tenantRes.error)
  }
  if (userRes.error) {
    console.error('get_user_id_by_email error:', userRes.error)
    captureException(userRes.error, { fn: 'get-invite', stage: 'user-lookup' })
    return err(500, 'user_lookup_failed', 'Failed to check user existence')
  }

  const userExists = userRes.data != null

  return json({
    success: true,
    email: invitation.email,
    roleName: roleData?.name ?? '—',
    tenantName: tenantRes.data?.name ?? '',
    userExists,
  }, { status: 200 })
}))
