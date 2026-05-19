import { createClient } from '@supabase/supabase-js'
import { captureException, flushSentry, withSentry } from '../_shared/sentry.ts'
import nodemailer from 'nodemailer'

// Унифицированный envelope ответа:
//   success: { success: true, message }
//   error:   { success: false, error, code }
// Любой исход «email отправлен / email не существует / SMTP не настроен» схлопнут
// в один success — чтобы атакующий не мог через ответ определить существование
// учётки. SMTP-сбой (нет коннекта / 5xx от relay) — единственное исключение:
// отдаём 503 + code='smtp_failed' (PREPROD-116), чтобы клиент мог retry'ить и
// отличить transient от рейт-лимита (429) / валидации (400).
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

const ok = () =>
  json({ success: true, message: 'Если такой email существует, на него отправлено письмо для сброса пароля.' }, { status: 200 })

const err = (status: number, code: string, error: string) =>
  json({ success: false, error, code }, { status })

// Durable rate-limit чтобы закрыть email-bomb. Storefront-flow ходит через Nitro
// (/api/auth/forgot-password — уже rate-limited там), но admin/login.vue зовёт
// функцию НАПРЯМУЮ через sb.functions.invoke без обёртки — без этого guard'а
// атакующий может через любой anon-key слать жертве сброс пароля в цикле.
const EMAIL_LIMIT = { max: 3, windowSeconds: 10 * 60 }
const IP_LIMIT = { max: 10, windowSeconds: 10 * 60 }

// RFC 5321 length + достаточно строгий формат, чтобы отсечь явный мусор.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    return err(405, 'method_not_allowed', 'Method Not Allowed')
  }

  let body: { email?: unknown; redirectTo?: unknown }
  try {
    body = await req.json()
  } catch {
    return err(400, 'invalid_body', 'Invalid JSON body')
  }

  if (!body.email || typeof body.email !== 'string') {
    return err(400, 'missing_fields', 'email is required')
  }
  const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined

  const normalizedEmail = body.email.trim().toLowerCase()
  if (normalizedEmail.length > 254 || !EMAIL_REGEX.test(normalizedEmail)) {
    return err(400, 'invalid_email', 'Некорректный email')
  }
  const ip = getClientIp(req)

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const [emailRl, ipRl] = await Promise.all([
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

  if (emailRl.error || ipRl.error) {
    console.error('consume_rate_limit error:', emailRl.error ?? ipRl.error)
    return err(500, 'rate_limit_failed', 'Failed to check rate limit')
  }

  if (emailRl.data === false || ipRl.data === false) {
    return err(429, 'rate_limited', 'Слишком много запросов. Попробуйте позже.')
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
    return ok()
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
    } catch (smtpErr) {
      // Transient SMTP failure → 503: клиент может ретраить, отличает от 429/400.
      // Откатываем consume_rate_limit для email+ip бакетов — иначе при системном
      // даунтайме юзер упрётся в 429 после 3 попыток и не сможет повторить.
      // Если release сам упал — логируем, но всё равно отдаём 503 (не маскируем
      // SMTP-ошибку проблемой со счётчиком).
      console.error('SMTP error:', smtpErr)
      captureException(smtpErr, { fn: 'send-recovery-email', stage: 'smtp-send' })
      const releases = await Promise.all([
        adminSupabase.rpc('release_rate_limit', { _key: `send-recovery-email:email:${normalizedEmail}` }),
        adminSupabase.rpc('release_rate_limit', { _key: `send-recovery-email:ip:${ip}` }),
      ])
      for (const r of releases) {
        if (r.error) console.error('release_rate_limit error:', r.error)
      }
      await flushSentry()
      return err(503, 'smtp_failed', 'Не удалось отправить письмо. Попробуйте ещё раз через минуту.')
    }
  } else {
    console.log(`Recovery URL for ${normalizedEmail}: ${recoveryUrl}`)
  }

  return ok()
}))
