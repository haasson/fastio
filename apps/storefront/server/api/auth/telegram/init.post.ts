import { defineEventHandler, getRequestIP } from 'h3'
import { randomUUID } from 'node:crypto'
import { createRateLimiter } from '@fastio/shared'
import { useRuntimeConfig } from '#imports'
import { getServerSupabase } from '../../../utils/supabase'
import { reportError } from '~/utils/reportError'

const NONCE_TTL_MS = 15 * 60 * 1000

const rateLimiter = createRateLimiter(5, 60_000)

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте позже.' })
  }

  const config = useRuntimeConfig()
  const botUsername = config.public.telegramAuthBotUsername
  if (!botUsername) throw createError({ statusCode: 503, message: 'Telegram auth не настроен' })

  const nonce = randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString()

  const supabase = getServerSupabase()
  const { error } = await supabase
    .from('pending_telegram_auths')
    .insert({ nonce, tenant_id: tenantId, expires_at: expiresAt })

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Ошибка сервера' })
  }

  return { nonce, botUsername }
})
