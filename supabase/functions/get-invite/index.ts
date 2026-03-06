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
    .select('email, role, expires_at, accepted_at, tenant_id')
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

  const [{ data: tenant }, { data: { users } }] = await Promise.all([
    adminSupabase
      .from('tenants')
      .select('name')
      .eq('id', invitation.tenant_id)
      .single(),
    adminSupabase.auth.admin.listUsers(),
  ])

  const userExists = users.some((u) => u.email === invitation.email)

  return json({
    email: invitation.email,
    role: invitation.role,
    tenantName: tenant?.name ?? '',
    userExists,
  }, { status: 200 })
})
