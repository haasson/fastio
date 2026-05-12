import { createClient } from 'npm:@supabase/supabase-js@2'
const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const { token } = await req.json() as { token: string }

  if (!token) {
    return json({ error: 'token is required' }, { status: 400 })
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: invitation } = await adminSupabase
    .from('tenant_invitations')
    .select('email, role_id, expires_at, accepted_at, tenant_id, tenant_roles(name)')
    .eq('token', token)
    .single()

  if (!invitation) {
    return json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (invitation.accepted_at) {
    return json({ error: 'Invitation already accepted' }, { status: 409 })
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return json({ error: 'Invitation expired' }, { status: 410 })
  }

  const roleData = (invitation as { tenant_roles?: { name: string } | null }).tenant_roles

  // Targeted lookup in auth.users by email — O(1) via index, не подвержен лимиту в 1000 у listUsers().
  const [{ data: tenant }, { count: userCount }] = await Promise.all([
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

  const userExists = (userCount ?? 0) > 0

  return json({
    email: invitation.email,
    roleName: roleData?.name ?? '—',
    tenantName: tenant?.name ?? '',
    userExists,
  }, { status: 200 })
})
