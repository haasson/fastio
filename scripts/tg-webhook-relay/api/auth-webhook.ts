// Vercel Edge Function — relay для Telegram webhook'ов Bot #2 (клиентский).
//
// Telegram блокирован РКН в обе стороны на прод-VPS (Timeweb NSK1):
//   - admin → api.telegram.org (фикс: sing-box VLESS tunnel в admin)
//   - Telegram → admin.fastio.ru (этот worker — фикс)
//
// Этот worker сидит на vercel.app, к нему Telegram может стучаться без проблем
// (Vercel IPs не блочат). Worker форвардит POST на наш admin как обычный HTTPS-
// запрос от не-российского IP — этот трафик не блочат.
//
// URL вида https://<project>.vercel.app/api/auth-webhook — прописывается в
// setWebhook у Bot #2. secret_token Telegram прокидывает в header
// x-telegram-bot-api-secret-token, мы его проксируем без изменений.

export const config = { runtime: 'edge' }

const TARGET = 'https://admin.fastio.ru/api/telegram/auth-webhook'

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
