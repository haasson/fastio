import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from '#imports'
import nodemailer from 'nodemailer'
import { requireInternalSecret } from '../../utils/auth'
import { telegramApiUrl, telegramFetch } from '../../utils/telegramFetch'
import { reportError } from '@fastio/shared/observability'
import { getServerSupabase } from '../../utils/supabase'

type WebhookInfo = {
  ok: boolean
  result?: {
    url?: string
    last_error_date?: number
    last_error_message?: string
    pending_update_count?: number
  }
}

// Не спамим: если последний алёрт был менее COOLDOWN_MINUTES назад — пропускаем.
const COOLDOWN_MINUTES = 60
// Ошибка считается свежей если произошла в последние ERROR_WINDOW_MINUTES.
const ERROR_WINDOW_MINUTES = 30
// Очередь считается проблемной если необработанных > PENDING_THRESHOLD.
const PENDING_THRESHOLD = 3

export default defineEventHandler(async (event) => {
  requireInternalSecret(event)

  const config = useRuntimeConfig()

  const bots = [
    { name: 'Клиентский бот (TG Login)', token: config.telegramClientBotToken?.trim() },
    { name: 'Тенант-бот (заказы/уведомления)', token: config.telegramTenantBotToken?.trim() },
  ].filter((b): b is { name: string; token: string } => Boolean(b.token))

  const nowSec = Math.floor(Date.now() / 1000)
  const issues: string[] = []

  for (const bot of bots) {
    try {
      const res = await telegramFetch(telegramApiUrl(bot.token, 'getWebhookInfo'))
      const data = await res.json() as WebhookInfo

      if (!data.ok || !data.result) continue

      const { last_error_date, last_error_message, pending_update_count = 0 } = data.result
      const recentError = last_error_date && (nowSec - last_error_date) < ERROR_WINDOW_MINUTES * 60

      if (recentError || pending_update_count > PENDING_THRESHOLD) {
        const lines: string[] = [`🤖 <b>${bot.name}</b>`]

        if (recentError) lines.push(`❌ ${last_error_message}`)

        if (pending_update_count > PENDING_THRESHOLD) lines.push(`⏳ Очередь: ${pending_update_count} необработанных`)
        issues.push(lines.join('\n'))
      }
    } catch (e) {
      reportError(e, { context: 'webhook-health:getWebhookInfo', bot: bot.name })
    }
  }

  if (!issues.length) return { ok: true, status: 'healthy' }

  // Cooldown: не спамим чаще раза в COOLDOWN_MINUTES
  const supabase = getServerSupabase()
  const { data: state } = await supabase
    .from('webhook_health_state')
    .select('last_alert_at')
    .eq('id', 1)
    .maybeSingle()

  if (state?.last_alert_at) {
    const lastAlertMs = new Date(state.last_alert_at).getTime()

    if (Date.now() - lastAlertMs < COOLDOWN_MINUTES * 60 * 1000) {
      return { ok: true, status: 'suppressed_by_cooldown' }
    }
  }

  await supabase
    .from('webhook_health_state')
    .upsert({ id: 1, last_alert_at: new Date().toISOString() }, { onConflict: 'id' })

  const text = [
    '🚨 <b>Webhook Health Alert</b>',
    '',
    ...issues,
    '',
    `Проверь логи: <code>docker logs &lt;admin-container&gt; --tail=50</code>`,
  ].join('\n')

  const telegramOk = await sendTelegramAlert(config, text)

  if (!telegramOk) await sendEmailFallback(config, text)

  return { ok: true, status: 'alerted', issueCount: issues.length }
})

async function sendTelegramAlert(config: ReturnType<typeof useRuntimeConfig>, text: string): Promise<boolean> {
  const token = config.telegramOpsBotToken?.trim()
  const chatId = String(config.telegramAlertChatId ?? '').trim()

  if (!token || !chatId) return false

  try {
    const res = await telegramFetch(telegramApiUrl(token, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))

      console.error('[webhook-health] Telegram alert failed:', JSON.stringify(err))

      return false
    }

    return true
  } catch (e) {
    reportError(e, { context: 'webhook-health:telegram' })

    return false
  }
}

async function sendEmailFallback(config: ReturnType<typeof useRuntimeConfig>, htmlText: string): Promise<void> {
  const smtpUser = config.smtpUser?.trim()
  const smtpPass = config.smtpPass?.trim()
  const alertEmail = config.alertEmail?.trim()
  const smtpHost = config.smtpHost?.trim() || 'smtp.timeweb.ru'

  if (!smtpUser || !smtpPass || !alertEmail) {
    console.warn('[webhook-health] Email fallback skipped: SMTP not configured')

    return
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    })

    const plain = htmlText.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

    await transporter.sendMail({
      from: `"Fastio Monitor" <${smtpUser}>`,
      to: alertEmail,
      subject: '🚨 Fastio: Webhook Health Alert',
      text: plain,
    })
  } catch (e) {
    reportError(e, { context: 'webhook-health:email-fallback' })
  }
}
