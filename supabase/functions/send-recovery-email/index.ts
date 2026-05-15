import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../_shared/sentry.ts'
import nodemailer from 'nodemailer'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

// Durable rate-limit чтобы закрыть email-bomb. Storefront-flow ходит через Nitro
// (/api/auth/forgot-password — уже rate-limited там), но admin/login.vue зовёт
// функцию НАПРЯМУЮ через sb.functions.invoke без обёртки — без этого guard'а
// атакующий может через любой anon-key слать жертве сброс пароля в цикле.
const EMAIL_LIMIT = { max: 3, windowSeconds: 10 * 60 }
const IP_LIMIT = { max: 10, windowSeconds: 10 * 60 }

function getClientIp(req: Request): string {
  // Приоритет: cf-connecting-ip (Cloudflare выставляет на edge, клиент подделать
  // не может) → x-real-ip (Supabase Edge proxy) → x-forwarded-for[0] (общий fallback).
  // Без них — 'unknown' (бакет общий, IP-лимит вырождается в глобальный, email-лимит
  // продолжает работать как основной защитный механизм).
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf
  const real = req.headers.get('x-real-ip')
  if (real) return real
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown'
  return 'unknown'
}

Deno.serve(withSentry('send-recovery-email', async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body: { email?: unknown; redirectTo?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.email || typeof body.email !== 'string') {
    return json({ error: 'email is required' }, { status: 400 })
  }
  const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined

  const normalizedEmail = body.email.trim().toLowerCase()
  const ip = getClientIp(req)

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const [{ data: emailOk }, { data: ipOk }] = await Promise.all([
    adminSupabase.rpc('consume_rate_limit', {
      _key: `send-recovery-email:email:${normalizedEmail}`,
      _max: EMAIL_LIMIT.max,
      _window_seconds: EMAIL_LIMIT.windowSeconds,
    }),
    adminSupabase.rpc('consume_rate_limit', {
      _key: `send-recovery-email:ip:${ip}`,
      _max: IP_LIMIT.max,
      _window_seconds: IP_LIMIT.windowSeconds,
    }),
  ])

  if (emailOk === false || ipOk === false) {
    return json({ error: 'rate_limited' }, { status: 429 })
  }

  // Генерируем ссылку восстановления через Admin API (без отправки письма)
  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: 'recovery',
    email: normalizedEmail,
    options: { redirectTo },
  })

  if (linkError || !linkData?.properties?.action_link) {
    // Не раскрываем существует ли email — всегда возвращаем success
    console.error('generateLink error:', linkError?.message ?? 'no action_link')
    return json({ success: true })
  }

  const recoveryUrl = linkData.properties.action_link

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
        to: normalizedEmail,
        subject: 'Сброс пароля — Fastio',
        html: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Сброс пароля</title>
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
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">Сброс пароля</h1>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Мы получили запрос на сброс пароля для вашего аккаунта. Нажмите кнопку ниже, чтобы задать новый пароль.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:10px;background:#ff6b35;">
                    <a href="${recoveryUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Сбросить пароль
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                Ссылка действительна 24 часа. Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.
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
    console.log(`Recovery URL for ${normalizedEmail}: ${recoveryUrl}`)
  }

  return json({ success: true })
}))
