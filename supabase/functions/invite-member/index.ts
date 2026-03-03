import { createClient } from 'npm:@supabase/supabase-js@2'

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

  const { tenantId, email, role } = await req.json() as {
    tenantId: string
    email: string
    role: string
  }

  if (!tenantId || !email || !role) {
    return new Response(JSON.stringify({ error: 'tenantId, email, role are required' }), { status: 400 })
  }

  if (!['admin', 'manager', 'staff'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Invalid role' }), { status: 400 })
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Проверяем что приглашающий — admin+ в этом тенанте
  const { data: membership } = await adminSupabase
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403 })
  }

  // Проверяем что email ещё не в команде
  const { data: existingMember } = await adminSupabase
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', (
      await adminSupabase.auth.admin.listUsers()
    ).data.users.find(u => u.email === email)?.id ?? '00000000-0000-0000-0000-000000000000')
    .maybeSingle()

  if (existingMember) {
    return new Response(JSON.stringify({ error: 'User is already a member' }), { status: 409 })
  }

  // Создаём приглашение (upsert по tenant_id+email)
  const { data: invitation, error: inviteError } = await adminSupabase
    .from('tenant_invitations')
    .upsert(
      {
        tenant_id: tenantId,
        email,
        role,
        invited_by: user.id,
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        accepted_at: null,
      },
      { onConflict: 'tenant_id,email' },
    )
    .select('token')
    .single()

  if (inviteError) {
    console.error('Invite error:', inviteError)
    return new Response(JSON.stringify({ error: 'Failed to create invitation' }), { status: 500 })
  }

  // Получаем имя тенанта для письма
  const { data: tenant } = await adminSupabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  const appUrl = Deno.env.get('APP_URL') ?? 'https://admin.fastio.ru'
  const inviteUrl = `${appUrl}/invite?token=${invitation.token}`

  // Отправляем email
  const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SENDGRID_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: [{ email }],
      from: { email: 'noreply@fastio.ru' },
      subject: `Приглашение в команду ${tenant?.name ?? 'Fastio'}`,
      content: [{
        type: 'text/plain',
        value: [
          `Вас пригласили в команду «${tenant?.name}» на платформе Fastio.`,
          '',
          `Роль: ${role}`,
          '',
          `Для принятия приглашения перейдите по ссылке:`,
          inviteUrl,
          '',
          'Ссылка действительна 7 дней.',
        ].join('\n'),
      }],
    }),
  })

  if (!sendgridResponse.ok) {
    console.error('SendGrid error:', await sendgridResponse.text())
  }

  return new Response(JSON.stringify({ success: true, token: invitation.token }), { status: 200 })
})
