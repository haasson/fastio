import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'
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

  const { tenantId, email, role, branchIds = [], force = false } = await req.json() as {
    tenantId: string
    email: string
    role: string
    branchIds?: string[]
    force?: boolean
  }

  if (!tenantId || !email || !role) {
    return json({ error: 'tenantId, email, role are required' }, { status: 400 })
  }

  if (!['admin', 'manager', 'staff'].includes(role)) {
    return json({ error: 'Invalid role' }, { status: 400 })
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
    return json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Проверяем статус: уже участник или есть pending-инвайт
  const { data: inviteStatus } = await adminSupabase
    .rpc('get_invite_status', { _tenant_id: tenantId, _email: email })

  if (inviteStatus === 'member') {
    return json({ error: 'Этот пользователь уже является участником команды' }, { status: 409 })
  }
  if (inviteStatus === 'pending' && !force) {
    return json({ error: 'Приглашение этому пользователю уже отправлено' }, { status: 409 })
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  if (inviteStatus === 'pending') {
    // force=true: обновляем существующий инвайт
    const { error: updateError } = await adminSupabase
      .from('tenant_invitations')
      .update({ token, expires_at: expiresAt, branch_ids: branchIds })
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .is('accepted_at', null)

    if (updateError) {
      console.error('Resend error:', updateError)
      return json({ error: 'Failed to resend invitation' }, { status: 500 })
    }
  } else {
    // Создаём новое приглашение
    const { error: inviteError } = await adminSupabase
      .from('tenant_invitations')
      .insert({
        tenant_id: tenantId,
        email,
        role,
        invited_by: user.id,
        token,
        expires_at: expiresAt,
        branch_ids: branchIds,
      })

    if (inviteError) {
      console.error('Invite error:', inviteError)
      return json({ error: 'Failed to create invitation' }, { status: 500 })
    }
  }

  // Получаем имя тенанта для письма
  const { data: tenant } = await adminSupabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  const appUrl = Deno.env.get('APP_URL') ?? 'https://admin.fastio.ru'
  const inviteUrl = `${appUrl}/invite?token=${token}`

  console.log(`Invite URL: ${inviteUrl}`)

  // Отправляем email через SMTP (на локалке секретов нет — только логируем)
  const smtpUser = Deno.env.get('SMTP_USER')
  const smtpPass = Deno.env.get('SMTP_PASS')

  if (smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST') ?? 'smtp.timeweb.ru',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    })

    try {
      await transporter.sendMail({
        from: `"Fastio" <${smtpUser}>`,
        to: email,
        subject: `Приглашение в команду ${tenant?.name ?? 'Fastio'}`,
        text: [
          `Вас пригласили в команду «${tenant?.name}» на платформе Fastio.`,
          '',
          `Роль: ${role}`,
          '',
          'Для принятия приглашения перейдите по ссылке:',
          inviteUrl,
          '',
          'Ссылка действительна 7 дней.',
        ].join('\n'),
      })
    } catch (err) {
      console.error('SMTP error:', err)
    }
  }

  return json({ success: true }, { status: 200 })
})
