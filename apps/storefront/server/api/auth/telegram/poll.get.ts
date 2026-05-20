import { defineEventHandler, getQuery, setCookie } from 'h3'
import { getTenantDb } from '../../../utils/tenantDb'
import { isSecureRequest } from '../../../utils/isSecureRequest'
import { issueSessionToken, TG_SESSION_COOKIE_NAME } from '../../../utils/telegramAuth'
import { findOrCreateCustomer } from '../../../utils/findOrCreateCustomer'
import { reportError } from '@fastio/shared/observability'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_TTL_SEC = SESSION_TTL_MS / 1000

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const { tenantId } = db

  const { nonce } = getQuery(event)
  if (!nonce || typeof nonce !== 'string') {
    throw createError({ statusCode: 400, message: 'Нет nonce' })
  }

  const { data: pending, error } = await db
    .from('pending_telegram_auths')
    .select('nonce, tenant_id, telegram_id, telegram_data, phone, expires_at, completed_at')
    .eq('nonce', nonce)
    .maybeSingle()

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Ошибка сервера' })
  }

  if (!pending) return { status: 'expired' }
  if (new Date(pending.expires_at) < new Date()) return { status: 'expired' }
  if (!pending.completed_at) return { status: 'pending' }

  // Auth completed — create customer session and set cookie
  const telegramId = pending.telegram_id as string
  const data = (pending.telegram_data ?? {}) as Record<string, string | null>
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null
  const phone = (pending.phone as string | null) ?? null

  const customerId = await findOrCreateCustomer(db.crossTenant, { tenantId, telegramId, name, phone })

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

  // Delete nonce — single use. db.raw намеренно: Proxy авто-инжектит .eq('tenant_id', tenantId) в delete (см. tenantDb.ts).
  await db.raw.from('pending_telegram_auths').delete().eq('nonce', nonce)

  setCookie(event, TG_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureRequest(event),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  })

  return { status: 'ok' }
})
