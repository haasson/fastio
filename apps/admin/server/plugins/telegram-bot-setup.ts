import { defineNitroPlugin } from 'nitropack/runtime'
import { useRuntimeConfig } from '#imports'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const token = config.telegramAuthBotToken
  const adminUrl = config.adminUrl

  if (!token || !adminUrl) return

  const webhookUrl = `${adminUrl}/api/telegram/auth-webhook`
  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
  }

  if (config.telegramWebhookSecret) {
    body.secret_token = config.telegramWebhookSecret
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
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
