import { createError, getHeader, type H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'

/**
 * Проверяет что запрос пришёл от внутреннего вызывающего (триггеры БД через pg_net,
 * cron из Supabase Edge Functions и т.п.). Секрет должен совпадать с
 * NUXT_INTERNAL_API_SECRET. Если переменная не задана — бросаем 500,
 * чтобы случайно не оставить endpoint открытым в проде.
 */
export function requireInternalSecret(event: H3Event) {
  const expected = useRuntimeConfig().internalApiSecret?.trim()

  if (!expected) {
    throw createError({ statusCode: 500, statusMessage: 'INTERNAL_API_SECRET is not configured' })
  }

  const incoming = getHeader(event, 'x-internal-secret')

  if (incoming !== expected) {
    throw createError({ statusCode: 403 })
  }
}

/**
 * PREPROD-212: defense-in-depth для Telegram-webhook'ов, которые приходят через
 * Vercel-relay (обход RKN-блока). Relay вешает `x-relay-secret` со значением
 * `RELAY_SECRET`. Admin сверяет с `NUXT_RELAY_SECRET`.
 *
 * Зачем поверх Telegram secret_token: если кто-то узнает Telegram-секрет
 * (например, утечка через `getWebhookInfo` у Telegram), он сможет напрямую
 * стучаться в admin.fastio.ru. Relay-secret гарантирует что путь только через
 * наш Vercel-проект.
 *
 * Секрет ОБЯЗАТЕЛЕН — если env не задан, бросаем 500 (secure by default).
 */
export function requireRelaySecret(event: H3Event) {
  // Dev-bypass: локально Telegram-webhook'и идут через ngrok/cloudflared
  // напрямую в admin, без Vercel-relay. В этом сценарии x-relay-secret
  // отсутствует, и без bypass'а вся дев-разработка Telegram-флоу падала бы
  // на 500. Strict-режим только в prod-сборке, где деплой гарантирует relay.
  if (import.meta.dev) return

  const expected = useRuntimeConfig().relaySecret?.trim()

  if (!expected) {
    throw createError({ statusCode: 500, statusMessage: 'RELAY_SECRET is not configured' })
  }

  if (getHeader(event, 'x-relay-secret') !== expected) {
    throw createError({ statusCode: 403 })
  }
}
