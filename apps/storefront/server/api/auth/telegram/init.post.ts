import { defineEventHandler } from 'h3'
import { randomUUID } from 'node:crypto'
import { createRateLimiter } from '@fastio/shared'
import { useRuntimeConfig } from '#imports'
import { getTenantDb } from '../../../utils/tenantDb'
import { getClientIp } from '../../../utils/clientIp'
import { reportError } from '~/shared/utils/reportError'

const NONCE_TTL_MS = 15 * 60 * 1000

const rateLimiter = createRateLimiter(5, 60_000)

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const ip = getClientIp(event)
  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const config = useRuntimeConfig()
  const botUsername = config.public.telegramAuthBotUsername
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
