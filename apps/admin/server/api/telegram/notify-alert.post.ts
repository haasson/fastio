import { defineEventHandler, readBody } from 'h3'
import * as Sentry from '@sentry/nuxt'
import { useRuntimeConfig } from '#imports'
import { requireInternalSecret } from '../../utils/auth'

// Endpoint для алёртов от monitor_edge_errors(). Вызывается из БД через pg_net
// каждые 15 мин если 4xx/5xx в net._http_response пробивают порог.
//
// chatId берётся из env (NUXT_TELEGRAM_ALERT_CHAT_ID), а не из body — чтобы
// БД не могла перенаправить алёрт в чужой чат при компрометации internal-secret.
// Шлём текстовое уведомление; никаких клиентских данных не светим.

export default defineEventHandler(async (event) => {
  requireInternalSecret(event)

  const { errorCount, totalCount, windowMinutes } = await readBody(event) as {
    errorCount?: number
    totalCount?: number
    windowMinutes?: number
  }

  const config = useRuntimeConfig()
  const token = config.telegramBotToken?.trim()
  const chatId = config.telegramAlertChatId?.trim()

  if (!token || !chatId) return { ok: true }

  const errors = Number(errorCount ?? 0)
  const total = Number(totalCount ?? 0)
  const window = Number(windowMinutes ?? 15)
  const errorRate = total > 0 ? Math.round((errors / total) * 100) : 0

  const text = [
    `⚠️ <b>Edge functions: всплеск ошибок</b>`,
    ``,
    `За последние ${window} мин:`,
    `🔴 4xx/5xx/timeouts: <b>${errors}</b>`,
    `📊 Всего вызовов: ${total} (${errorRate}%)`,
    ``,
    `Проверь edge-logs: <code>docker logs supabase-edge-runtime</code>`,
    `Sentry: проект edge-functions → recent issues`,
  ].join('\n')

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })

  if (!tgRes.ok) {
    const err = await tgRes.json().catch(() => ({}))
    const detail = JSON.stringify(err)

    console.error('[telegram notify-alert] sendMessage failed:', detail)
    Sentry.captureMessage(`telegram notify-alert sendMessage failed: ${detail}`, 'error')
  }

  return { ok: true }
})
