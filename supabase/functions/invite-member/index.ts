import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../_shared/sentry.ts'
import nodemailer from 'nodemailer'

// Унифицированный envelope ответа:
//   success: { success: true, message: string }
//   error:   { success: false, error: string, code: string }
// Все success-like исходы (реальная отправка, уже участник, pending-invite без force)
// схлопнуты в единый 200 — иначе team-manager может выявить, в каких чужих тенантах
// email зарегистрирован (PREPROD-107, security audit S14).
const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } })

const ok = (message: string) =>
  json({ success: true, message }, { status: 200 })

const err = (status: number, code: string, error: string) =>
  json({ success: false, error, code }, { status })

const GENERIC_SUCCESS = 'Приглашение обработано'

// RFC 5321 length + достаточно строгий формат, чтобы отсечь явный мусор. Не валидируем
// каждую возможную форму email — задача отсечь bot-payload, не пройти полную RFC 5322.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Durable per-(user, target) rate-limit — даже team-manager не должен спамить
// инвайтами один email. consume_rate_limit RPC — миграция 264.
const INVITE_LIMIT = { max: 3, windowSeconds: 10 * 60 }

Deno.serve(withSentry('invite-member', async (req) => {
  if (req.method !== 'POST') {
    return err(405, 'method_not_allowed', 'Method Not Allowed')
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return err(401, 'unauthorized', 'Unauthorized')
  }

  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await userSupabase.auth.getUser()
  if (authError || !user) {
    return err(401, 'unauthorized', 'Unauthorized')
  }

  let payload: { tenantId?: unknown; email?: unknown; roleId?: unknown; branchIds?: unknown; force?: unknown }
  try {
    payload = await req.json()
  } catch {
    return err(400, 'invalid_body', 'Invalid JSON body')
  }

  const tenantId = typeof payload.tenantId === 'string' ? payload.tenantId : ''
  const emailRaw = typeof payload.email === 'string' ? payload.email : ''
  const roleId = typeof payload.roleId === 'string' ? payload.roleId : ''
  const branchIds = Array.isArray(payload.branchIds)
    ? payload.branchIds.filter((b): b is string => typeof b === 'string')
    : []
  const force = payload.force === true

  if (!tenantId || !emailRaw || !roleId) {
    return err(400, 'missing_fields', 'tenantId, email, roleId are required')
  }

  const normalizedEmail = emailRaw.trim().toLowerCase()
  if (normalizedEmail.length > 254 || !EMAIL_REGEX.test(normalizedEmail)) {
    return err(400, 'invalid_email', 'Некорректный email')
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Durable rate-limit ДО любых БД-чтений. Ключ — пара (приглашающий, цель), чтобы
  // team-manager не мог в цикле слать инвайты одному email'у. Параметризован
  // tenant_id, чтобы один user, управляющий несколькими тенантами, не «съел» лимит
  // по случайной коллизии с другим тенантом.
  const { data: rlOk, error: rlErr } = await adminSupabase.rpc('consume_rate_limit', {
    _key: `invite-member:${tenantId}:${user.id}:${normalizedEmail}`,
    _max: INVITE_LIMIT.max,
    _window_seconds: INVITE_LIMIT.windowSeconds,
  })

  if (rlErr) {
    console.error('consume_rate_limit error:', rlErr)
    return err(500, 'rate_limit_failed', 'Failed to check rate limit')
  }

  if (rlOk === false) {
    return err(429, 'rate_limited', 'Слишком много приглашений на этот email. Попробуйте позже.')
  }

  // Проверяем что roleId существует для этого тенанта
  const { data: targetRole, error: roleErr } = await adminSupabase
    .from('tenant_roles')
    .select('id, name, permissions')
    .eq('id', roleId)
    .eq('tenant_id', tenantId)
    .single()

  if (roleErr || !targetRole) {
    return err(400, 'invalid_role', 'Invalid role')
  }

  // Проверяем что приглашающий имеет permission team.manage
  const { data: membership, error: memErr } = await adminSupabase
    .from('tenant_members')
    .select('role_id, tenant_roles(permissions)')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  if (memErr || !membership) {
    return err(403, 'forbidden', 'Insufficient permissions')
  }

  // Owner (role_id IS NULL) имеет все пермишены
  const isOwner = membership.role_id === null
  const permissions = (membership as { tenant_roles?: { permissions?: Record<string, boolean> } }).tenant_roles?.permissions
  if (!isOwner && !permissions?.['team.manage']) {
    return err(403, 'forbidden', 'Insufficient permissions')
  }

  // Не-owner не может назначить роль с пермишенами, которых нет у него самого
  if (!isOwner) {
    const targetPerms = (targetRole as { permissions?: Record<string, boolean> }).permissions ?? {}
    const callerPerms = permissions ?? {}
    const hasEscalation = Object.entries(targetPerms)
      .filter(([, v]) => v === true)
      .some(([key]) => !callerPerms[key])

    if (hasEscalation) {
      return err(403, 'role_escalation', 'Cannot assign a role with permissions you don\'t have')
    }
  }

  // Проверяем статус: уже участник или есть pending-инвайт.
  // ВАЖНО: оба случая (member / pending без force) возвращают тот же 200, что и
  // успешная отправка — без этого вызывающий мог бы перебором email'ов выявить,
  // в каких чужих тенантах email зарегистрирован (PREPROD-107).
  const { data: inviteStatus, error: statusErr } = await adminSupabase
    .rpc('get_invite_status', { _tenant_id: tenantId, _email: normalizedEmail })

  if (statusErr) {
    console.error('get_invite_status error:', statusErr)
    return err(500, 'status_check_failed', 'Failed to check invite status')
  }

  if (inviteStatus === 'member') {
    return ok(GENERIC_SUCCESS)
  }
  if (inviteStatus === 'pending' && !force) {
    return ok(GENERIC_SUCCESS)
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  if (inviteStatus === 'pending') {
    // force=true: обновляем существующий инвайт
    const { error: updateError } = await adminSupabase
      .from('tenant_invitations')
      .update({ token, expires_at: expiresAt, role_id: roleId, branch_ids: branchIds })
      .eq('tenant_id', tenantId)
      .eq('email', normalizedEmail)
      .is('accepted_at', null)

    if (updateError) {
      console.error('Resend error:', updateError)
      return err(500, 'resend_failed', 'Failed to resend invitation')
    }
  } else {
    // Создаём новое приглашение
    const { error: inviteError } = await adminSupabase
      .from('tenant_invitations')
      .insert({
        tenant_id: tenantId,
        email: normalizedEmail,
        role_id: roleId,
        invited_by: user.id,
        token,
        expires_at: expiresAt,
        branch_ids: branchIds,
      })

    if (inviteError) {
      console.error('Invite error:', inviteError)
      return err(500, 'invite_failed', 'Failed to create invitation')
    }
  }

  // Получаем имя тенанта для письма
  const { data: tenant, error: tenantErr } = await adminSupabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  if (tenantErr) {
    // Не блокирующая ошибка — упадёт только subject/body персонализация,
    // ниже подставим дефолтное имя. Логируем для Sentry.
    console.error('tenant lookup error:', tenantErr)
  }

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

    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    const safeTenantName = escapeHtml(tenant?.name ?? 'Fastio')
    const roleLabel = escapeHtml(targetRole.name)

    try {
      await transporter.sendMail({
        from: `"Fastio" <${smtpUser}>`,
        to: normalizedEmail,
        // subject — SMTP-заголовок (plain text), HTML-escape не нужен.
        // \r\n-strip обязателен: иначе CRLF в имени тенанта = header-injection.
        subject: `Вас пригласили в команду «${tenant?.name ?? 'Fastio'}»`.replace(/[\r\n]/g, ' '),
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
                Вы получили приглашение присоединиться к команде <strong style="color:#111827;">${safeTenantName}</strong> на платформе Fastio.
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
    } catch (smtpErr) {
      console.error('SMTP error:', smtpErr)
    }
  }

  return ok(GENERIC_SUCCESS)
}))
