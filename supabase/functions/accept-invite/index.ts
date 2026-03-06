import { createClient } from 'npm:@supabase/supabase-js@2'
const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await userSupabase.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { token } = await req.json() as { token: string }
  if (!token) {
    return json({ error: 'token is required' }, { status: 400 })
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Находим приглашение
  const { data: invitation } = await adminSupabase
    .from('tenant_invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .single()

  if (!invitation) {
    return json({ error: 'Invitation not found or already accepted' }, { status: 404 })
  }

  // Проверяем срок
  if (new Date(invitation.expires_at) < new Date()) {
    return json({ error: 'Invitation expired' }, { status: 410 })
  }

  // Проверяем email
  if (user.email !== invitation.email) {
    return json({ error: 'Email mismatch' }, { status: 403 })
  }

  // Создаём membership
  const { error: memberError } = await adminSupabase
    .from('tenant_members')
    .insert({
      tenant_id: invitation.tenant_id,
      user_id: user.id,
      role: invitation.role,
    })

  if (memberError) {
    if (memberError.code === '23505') {
      return json({ error: 'Already a member' }, { status: 409 })
    }
    console.error('Member insert error:', memberError)
    return json({ error: 'Failed to join team' }, { status: 500 })
  }

  // Помечаем приглашение как принятое
  await adminSupabase
    .from('tenant_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return json({
    success: true,
    tenantId: invitation.tenant_id,
    role: invitation.role,
  }, { status: 200 })
})
