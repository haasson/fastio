// Vercel Edge Function — relay для Telegram webhook'ов Bot #1 (tenant).
//
// Bot #1 (@fastio_order_bot) принимает /start <код> для привязки чата к тенанту
// (uplink в админку → tenants.notifications.telegramChatId). РКН блочит входящие
// от Telegram на admin.fastio.ru, поэтому ходим через vercel-релей.
//
// Парный к auth-webhook.ts (Bot #2). Прописывается в setWebhook через плагин
// admin'ки по env NUXT_TELEGRAM_TENANT_WEBHOOK_URL.

export const config = { runtime: 'edge' }

const TARGET = 'https://admin.fastio.ru/api/telegram/webhook'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()
  const secretToken = req.headers.get('x-telegram-bot-api-secret-token')

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secretToken) headers['x-telegram-bot-api-secret-token'] = secretToken

  // PREPROD-212: defense-in-depth shared secret между relay и admin. Telegram
  // secret_token Telegram'а отдельно проверяется в admin; relay-secret гарантирует
  // что запрос прошёл именно через наш Vercel-проект, а не от подделанного клиента
  // с подсмотренным Telegram-секретом. Если RELAY_SECRET не задан — не вешаем
  // header (legacy-режим, admin тогда отвергнёт). Это secure-by-default на стороне admin.
  const relaySecret = process.env.RELAY_SECRET
  if (relaySecret) headers['x-relay-secret'] = relaySecret

  try {
    const res = await fetch(TARGET, { method: 'POST', headers, body })
    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    })
  } catch (err) {
    console.error('[tg-relay] forward failed:', err)
    return new Response(JSON.stringify({ ok: false, error: 'relay_failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
