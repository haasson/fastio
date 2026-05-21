import { defineEventHandler, readBody, getQuery, createError } from 'h3'
import * as Sentry from '@sentry/nuxt'
import { useRuntimeConfig } from '#imports'
import { telegramApiUrl, telegramFetch } from '../../utils/telegramFetch'

// Slack-compatible webhook endpoint for GlitchTip alerts.
// Configure in GlitchTip: Project → Settings → Alerts → Add Recipient
//   → General (slack-compatible) Webhook
//   → URL: https://admin.fastio.ru/api/telegram/glitchtip-alert?secret=<NUXT_GLITCHTIP_WEBHOOK_SECRET>

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const expectedSecret = config.glitchtipWebhookSecret?.trim()

  if (expectedSecret) {
    const { secret } = getQuery(event)

    if (secret !== expectedSecret) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
  }

  const body = await readBody(event) as {
    text?: string
    attachments?: Array<{ title?: string; title_link?: string; text?: string }>
  }

  const token = config.telegramOpsBotToken?.trim()
  const chatId = String(config.telegramAlertChatId ?? '').trim()

  if (!token || !chatId) return { ok: true }

  const title = body.attachments?.[0]?.title ?? body.text ?? 'Новая ошибка'
  const link = body.attachments?.[0]?.title_link
  const detail = body.attachments?.[0]?.text ?? ''

  const lines = [
    `🚨 <b>GlitchTip: ${title}</b>`,
    ...(detail ? [`${detail}`] : []),
    ...(link ? [`<a href="${link}">Открыть в GlitchTip</a>`] : []),
  ]

  const tgRes = await telegramFetch(telegramApiUrl(token, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  if (!tgRes.ok) {
    const err = await tgRes.json().catch(() => ({}))
    const detail = JSON.stringify(err)

    console.error('[glitchtip-alert] sendMessage failed:', detail)
    Sentry.captureMessage(`glitchtip-alert sendMessage failed: ${detail}`, 'error')
  }

  return { ok: true }
})
