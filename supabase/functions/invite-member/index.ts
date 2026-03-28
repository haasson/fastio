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

    const roleLabels: Record<string, string> = {
      admin: 'Администратор',
      manager: 'Менеджер',
      staff: 'Сотрудник',
    }
    const roleLabel = roleLabels[role] ?? role

    try {
      await transporter.sendMail({
        from: `"Fastio" <${smtpUser}>`,
        to: email,
        subject: `Вас пригласили в команду «${tenant?.name ?? 'Fastio'}»`,
        html: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Приглашение в команду</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="12" fill="#ff6b35"/>
                <path d="M20 6h10l-4 16h8L18 42l4-16h-8z" fill="#ffffff"/>
              </svg>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px 40px 32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">Вас приглашают в команду</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                Вы получили приглашение присоединиться к команде <strong style="color:#111827;">${tenant?.name}</strong> на платформе Fastio.
              </p>
              <table cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:28px;width:100%;">
                <tr>
                  <td style="font-size:13px;color:#6b7280;">Роль</td>
                  <td align="right" style="font-size:14px;font-weight:600;color:#111827;">${roleLabel}</td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:10px;background:#ff6b35;">
                    <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Принять приглашение
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                Ссылка действительна 7 дней. Если вы не ожидали этого письма — просто проигнорируйте его.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:13px;color:#9ca3af;">© Fastio · Платформа для бизнеса</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      })
    } catch (err) {
      console.error('SMTP error:', err)
    }
  }

  return json({ success: true }, { status: 200 })
})
