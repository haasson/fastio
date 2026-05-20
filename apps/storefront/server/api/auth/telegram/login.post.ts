import { defineEventHandler, readBody, setCookie } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getTenantDb } from '../../../utils/tenantDb'
import { getClientIp } from '@fastio/shared/server'
import { isSecureRequest } from '../../../utils/isSecureRequest'
import { enforceRateLimit } from '../../../utils/enforceRateLimit'
import {
  verifyTelegramAuth,
  issueSessionToken,
  TG_SESSION_COOKIE_NAME,
} from '../../../utils/telegramAuth'
import { findOrCreateCustomer } from '../../../utils/findOrCreateCustomer'
import { reportError } from '@fastio/shared/observability'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_TTL_SEC = SESSION_TTL_MS / 1000

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const { tenantId } = db

  const ip = getClientIp(event)
  // Два правила: global per-IP cap (закрывает credential-stuffing через
  // итерацию по чужим tenant-доменам с одного IP) + per-(tenant, IP) cap
  // (защита конкретного тенанта от флуда). См. CR-01 в REVIEW PREPROD-102.
  await enforceRateLimit(
    [
      { key: `tg-auth-login:ip:${ip}`, max: 30, windowSeconds: 60 },
      { key: `tg-auth-login:tenant-ip:${tenantId}:${ip}`, max: 10, windowSeconds: 60 },
    ],
    'Слишком много запросов. Попробуйте позже.',
  )

  const config = useRuntimeConfig()
  const botToken = config.telegramClientBotToken
  if (!botToken) throw createError({ statusCode: 503, message: 'Telegram auth не настроен' })

  const body = await readBody(event)
  const verification = verifyTelegramAuth(body ?? {}, botToken)

  if (!verification.ok) {
    if (verification.reason === 'missing') throw createError({ statusCode: 400, message: 'Неверные данные' })
    if (verification.reason === 'expired') throw createError({ statusCode: 401, message: 'Данные авторизации устарели' })
    throw createError({ statusCode: 401, message: 'Неверная подпись' })
  }

  const { telegramId, firstName, lastName, photoUrl } = verification

  const customerId = await findOrCreateCustomer(db.crossTenant, {
    tenantId,
    telegramId,
    name: [firstName, lastName].filter(Boolean).join(' ') || null,
    photoUrl,
  })

  const { token, hash } = issueSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

  const { error: sessionError } = await db.crossTenant
    .from('customer_sessions')
    .insert({
      token_hash: hash,
      customer_id: customerId,
      tenant_id: tenantId,
      telegram_id: telegramId,
      expires_at: expiresAt,
    })

  if (sessionError) {
    reportError(sessionError)
    throw createError({ statusCode: 500, message: 'Ошибка создания сессии' })
  }

  // `secure` зависит от реального протокола запроса (xfp-aware): за Traefik
  // TLS терминируется на прокси, socket всегда non-encrypted, — без чтения
  // x-forwarded-proto Secure-cookie не выставится и сессия не сохранится.
  setCookie(event, TG_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureRequest(event),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  })

  return { ok: true }
})
