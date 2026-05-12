import { createError, getHeader, getRequestHeader, type H3Event } from 'h3'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'

// Singleton service-role клиент: переиспользуется между запросами в пределах одного nitro instance,
// чтобы не создавать новый http-клиент на каждый вызов requireMemberOfTenant().
let cachedAdminClient: SupabaseClient | null = null

function getAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient

  const config = useRuntimeConfig()

  cachedAdminClient = createClient(config.public.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cachedAdminClient
}

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
 * Проверяет подпись Telegram webhook'а через `x-telegram-bot-api-secret-token`.
 * Секрет ОБЯЗАТЕЛЕН — если переменная не задана, бросаем 500 (secure by default).
 */
export function requireTelegramWebhookSecret(event: H3Event) {
  const expected = useRuntimeConfig().telegramWebhookSecret?.trim()

  if (!expected) {
    throw createError({ statusCode: 500, statusMessage: 'TELEGRAM_WEBHOOK_SECRET is not configured' })
  }

  if (getHeader(event, 'x-telegram-bot-api-secret-token') !== expected) {
    throw createError({ statusCode: 403 })
  }
}

/**
 * Валидирует Supabase JWT, проверяет членство пользователя в указанном тенанте,
 * и что аккаунт не заблокирован. Возвращает userId.
 * Не доверяй userId/tenantId из body — всегда верифицируй здесь.
 */
export async function requireMemberOfTenant(
  event: H3Event,
  tenantId: string,
): Promise<{ userId: string }> {
  const authHeader = getRequestHeader(event, 'authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const config = useRuntimeConfig()
  const userClient = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error } = await userClient.auth.getUser()

  if (error || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
  }

  // Через service-role минуем RLS на tenant_members, плюс берём blocked_until для финального чека.
  const { data: membership } = await getAdminClient()
    .from('tenant_members')
    .select('user_id, blocked_until')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this tenant' })
  }

  if (membership.blocked_until && new Date(membership.blocked_until).getTime() > Date.now()) {
    throw createError({ statusCode: 403, statusMessage: 'Account is blocked' })
  }

  return { userId: user.id }
}
