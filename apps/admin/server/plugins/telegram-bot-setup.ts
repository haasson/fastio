import { defineNitroPlugin } from 'nitropack/runtime'
import { useRuntimeConfig } from '#imports'
import { telegramApiUrl, telegramFetch } from '../utils/telegramFetch'

type BotSpec = {
  label: string
  token: string
  webhookUrl: string
  secret?: string
}

async function setupBot({ label, token, webhookUrl, secret }: BotSpec) {
  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
  }

  if (secret) body.secret_token = secret

  try {
    const res = await telegramFetch(telegramApiUrl(token, 'setWebhook'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { ok: boolean; description?: string }

    if (!data.ok) {
      console.error(`[${label}] setWebhook failed:`, data.description)
    }
  } catch (err) {
    console.error(`[${label}] setWebhook error:`, err)
  }
}

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const adminUrl = config.adminUrl
  const secret = config.telegramWebhookSecret || undefined

  if (!adminUrl) return

  // Vercel-relay обходит РКН-блок входящих от Telegram на наш РФ-VPS. Если env
  // не задан — fallback на прямой admin URL (для локалки/не-РФ деплоев).
  const clientWebhook = config.telegramAuthWebhookUrl?.trim()
    || `${adminUrl}/api/telegram/auth-webhook`
  const tenantWebhook = config.telegramTenantWebhookUrl?.trim()
    || `${adminUrl}/api/telegram/webhook`

  const bots: BotSpec[] = []

  if (config.telegramClientBotToken) {
    bots.push({
      label: 'telegram-client-bot',
      token: config.telegramClientBotToken,
      webhookUrl: clientWebhook,
      secret,
    })
  }

  if (config.telegramTenantBotToken) {
    bots.push({
      label: 'telegram-tenant-bot',
      token: config.telegramTenantBotToken,
      webhookUrl: tenantWebhook,
      secret,
    })
  }

  await Promise.all(bots.map(setupBot))
})
