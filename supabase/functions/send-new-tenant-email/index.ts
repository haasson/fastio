import nodemailer from 'nodemailer'
import { withSentry } from '../_shared/sentry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-fastio-internal-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

// Server-to-server секрет: функцию должны звать ТОЛЬКО серверные Nitro endpoints
// (landing/register, backoffice/tenants). Anon-key публичен и не годится для
// аутентификации источника — без X-Fastio-Internal-Token любой может отправлять
// фишинг-письма с произвольным tenantName на любые email'ы.
//
// Настройка: supabase secrets set FASTIO_INTERNAL_TOKEN=<random32>
// Caller'ы должны передавать тот же секрет через NUXT_FASTIO_INTERNAL_TOKEN env.
const INTERNAL_TOKEN = Deno.env.get('FASTIO_INTERNAL_TOKEN')

// Защита от HTML-injection в письме (mail-клиенты типа Outlook иногда исполняют).
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// adminUrl попадает в href; принимаем ТОЛЬКО https://-схемы.
function safeAdminUrl(raw: string | undefined): string {
  if (raw && /^https:\/\/[a-z0-9.-]+/i.test(raw)) return raw
  return 'https://admin.fastio.ru'
}

Deno.serve(withSentry('send-new-tenant-email', async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  if (!INTERNAL_TOKEN) {
    console.error('FASTIO_INTERNAL_TOKEN is not configured')
    return json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (req.headers.get('x-fastio-internal-token') !== INTERNAL_TOKEN) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { email?: unknown; tenantName?: unknown; adminUrl?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, tenantName, adminUrl } = body
  if (!email || typeof email !== 'string' || !tenantName || typeof tenantName !== 'string') {
    return json({ error: 'email and tenantName are required' }, { status: 400 })
  }

  const loginUrl = safeAdminUrl(typeof adminUrl === 'string' ? adminUrl : undefined)
  const safeTenantName = escapeHtml(tenantName)

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
        // subject — SMTP-заголовок (plain text), HTML-escape не нужен.
        // \r\n-strip обязателен: иначе CRLF в имени тенанта = header-injection.
        subject: `Новое заведение «${tenantName}» добавлено в ваш аккаунт`.replace(/[\r\n]/g, ' '),
        html: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Новое заведение</title>
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
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">Новое заведение</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                Для вашего аккаунта на платформе Fastio было создано новое заведение — <strong style="color:#111827;">${safeTenantName}</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Вы можете войти в панель управления с вашими текущими данными для входа и переключиться на новое заведение.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:10px;background:#ff6b35;">
                    <a href="${loginUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Перейти в панель управления
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                Если вы не ожидали этого письма — просто проигнорируйте его.
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
  } else {
    console.log(`[send-new-tenant-email] No SMTP configured. Tenant "${tenantName}" added for ${email}`)
  }

  return json({ success: true })
}))
