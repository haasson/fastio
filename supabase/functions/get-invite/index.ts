import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../_shared/sentry.ts'

// Унифицированный envelope ответа:
//   success: { success: true, email, roleName, tenantName, userExists }
//   error:   { success: false, error, code }
const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } })

const err = (status: number, code: string, error: string) =>
  json({ success: false, error, code }, { status })

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

  // Targeted lookup in auth.users by email — O(1) via index, не подвержен лимиту в 1000 у listUsers().
  const [tenantRes, userRes] = await Promise.all([
    adminSupabase
      .from('tenants')
      .select('name')
      .eq('id', invitation.tenant_id)
      .single(),
    adminSupabase
      .schema('auth')
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('email', invitation.email),
  ])

  if (tenantRes.error) {
    // Не блокирующе — подставим пустое имя ниже. Логируем для Sentry.
    console.error('tenant lookup error:', tenantRes.error)
  }
  if (userRes.error) {
    console.error('auth.users count error:', userRes.error)
    return err(500, 'user_lookup_failed', 'Failed to check user existence')
  }

  const userExists = (userRes.count ?? 0) > 0

  return json({
    success: true,
    email: invitation.email,
    roleName: roleData?.name ?? '—',
    tenantName: tenantRes.data?.name ?? '',
    userExists,
  }, { status: 200 })
}))
