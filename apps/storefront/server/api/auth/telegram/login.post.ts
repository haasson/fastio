import { defineEventHandler, readBody, getRequestProtocol, setCookie } from 'h3'
import { useRuntimeConfig } from '#imports'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTenantDb } from '../../../utils/tenantDb'
import { getClientIp } from '../../../utils/clientIp'
import { enforceRateLimit } from '../../../utils/enforceRateLimit'
import {
  verifyTelegramAuth,
  issueSessionToken,
  TG_SESSION_COOKIE_NAME,
} from '../../../utils/telegramAuth'
import { reportError } from '~/shared/utils/reportError'

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

  // Bind `secure` to the actual request protocol (xfp-aware) instead of `!import.meta.dev`:
  // staging/preview domains run prod-mode but may serve over http, where Secure-cookies are dropped.
  setCookie(event, TG_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  })

  return { ok: true }
})

type CustomerSeed = {
  tenantId: string
  telegramId: string
  name: string | null
  photoUrl: string | null
}

async function findOrCreateCustomer(
  supabase: SupabaseClient,
  seed: CustomerSeed,
): Promise<string> {
  const existing = await lookupCustomer(supabase, seed.tenantId, seed.telegramId)
  if (existing) return existing

  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      tenant_id: seed.tenantId,
      telegram_id: seed.telegramId,
      name: seed.name,
      avatar_url: seed.photoUrl,
    })
    .select('id')
    .single()

  if (created) return created.id as string

  // Concurrent insert won the race — re-read the row our peer just created.
  if (error?.code === '23505') {
    const concurrent = await lookupCustomer(supabase, seed.tenantId, seed.telegramId)
    if (concurrent) return concurrent
  }

  reportError(error ?? new Error('customer insert returned no row'))
  throw createError({ statusCode: 500, message: 'Ошибка создания профиля' })
}

async function lookupCustomer(
  supabase: SupabaseClient,
  tenantId: string,
  telegramId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Ошибка базы данных' })
  }
  return data ? (data.id as string) : null
}
