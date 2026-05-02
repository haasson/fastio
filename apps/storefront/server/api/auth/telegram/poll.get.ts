import { defineEventHandler, getQuery, getRequestProtocol, setCookie } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTenantDb } from '../../../utils/tenantDb'
import { issueSessionToken, TG_SESSION_COOKIE_NAME } from '../../../utils/telegramAuth'
import { reportError } from '~/utils/reportError'

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

  const customerId = await findOrCreateCustomer(db.raw, { tenantId, telegramId, name, phone })

  const { token, hash } = issueSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

  // INSERT: tenant_id is in the payload, use raw client to avoid WHERE-clause conflict
  const { error: sessionError } = await db.raw
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

  // Delete nonce — single use
  await db.raw.from('pending_telegram_auths').delete().eq('nonce', nonce)

  setCookie(event, TG_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  })

  return { status: 'ok' }
})

type CustomerSeed = { tenantId: string; telegramId: string; name: string | null; phone: string | null }

async function findOrCreateCustomer(
  supabase: SupabaseClient,
  seed: CustomerSeed,
): Promise<string> {
  const { data: existing } = await supabase
    .from('customers')
    .select('id, phone')
    .eq('tenant_id', seed.tenantId)
    .eq('telegram_id', seed.telegramId)
    .maybeSingle()

  if (existing) {
    // Update phone if user just shared it and didn't have one before
    if (seed.phone && !existing.phone) {
      await supabase.from('customers').update({ phone: seed.phone }).eq('id', existing.id)
    }
    return existing.id as string
  }

  const { data: created, error } = await supabase
    .from('customers')
    .insert({ tenant_id: seed.tenantId, telegram_id: seed.telegramId, name: seed.name, phone: seed.phone })
    .select('id')
    .single()

  if (created) return created.id as string

  // Race condition: concurrent insert — re-read
  if (error?.code === '23505') {
    const { data: concurrent } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', seed.tenantId)
      .eq('telegram_id', seed.telegramId)
      .maybeSingle()
    if (concurrent) return concurrent.id as string
  }

  reportError(error ?? new Error('customer insert returned no row'))
  throw createError({ statusCode: 500, message: 'Ошибка создания профиля' })
}
