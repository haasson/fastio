import { defineEventHandler } from 'h3'
import { randomUUID } from 'node:crypto'
import { useRuntimeConfig } from '#imports'
import { getTenantDb } from '../../../utils/tenantDb'
import { getClientIp } from '@fastio/shared/server'
import { enforceRateLimit } from '../../../utils/enforceRateLimit'
import { reportError } from '@fastio/shared/observability'

const NONCE_TTL_MS = 15 * 60 * 1000

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const ip = getClientIp(event)
  // Global per-IP cap + per-(tenant, IP). Глобальный закрывает флуд
  // pending_telegram_auths через итерацию по чужим tenant-доменам. См. CR-01.
  await enforceRateLimit(
    [
      { key: `tg-auth-init:ip:${ip}`, max: 15, windowSeconds: 60 },
      { key: `tg-auth-init:tenant-ip:${db.tenantId}:${ip}`, max: 5, windowSeconds: 60 },
    ],
    'Слишком много запросов. Попробуйте позже.',
  )

  const config = useRuntimeConfig()
  const botUsername = config.public.telegramClientBotUsername
  if (!botUsername) throw createError({ statusCode: 503, message: 'Telegram auth не настроен' })

  const nonce = randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString()

  // INSERT: tenant_id is in the payload, crossTenant bypasses the insert-block proxy
  const { error } = await db.crossTenant
    .from('pending_telegram_auths')
    .insert({ nonce, tenant_id: db.tenantId, expires_at: expiresAt })

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Ошибка сервера' })
  }

  return { nonce, botUsername }
})
