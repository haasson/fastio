import { defineNitroPlugin } from 'nitropack/runtime'
import { useRuntimeConfig } from '#imports'
import { telegramFetch } from '../utils/telegramFetch'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const token = config.telegramClientBotToken
  const adminUrl = config.adminUrl

  if (!token || !adminUrl) return

  // Если задан внешний relay (например vercel-edge для обхода RKN-блока
  // входящих от Telegram в РФ-VPS) — используем его. Иначе fallback на
  // прямой admin URL (для локалки и не-РФ деплоев).
  const webhookUrl = config.telegramAuthWebhookUrl?.trim()
    || `${adminUrl}/api/telegram/auth-webhook`
  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
  }

  if (config.telegramWebhookSecret) {
    body.secret_token = config.telegramWebhookSecret
  }

  try {
    const res = await telegramFetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { ok: boolean; description?: string }

    if (!data.ok) {
      console.error('[telegram-auth-bot] setWebhook failed:', data.description)
    }
  } catch (err) {
    console.error('[telegram-auth-bot] setWebhook error:', err)
  }
})
