import { createClient } from '@supabase/supabase-js'
import { mapCustomer } from '../../utils/supabase'
import { getTenantDb } from '../../utils/tenantDb'
import { getClientIp } from '../../utils/clientIp'
import { enforceRateLimit } from '../../utils/enforceRateLimit'

// Durable per-email/per-IP лимит против brute-force. consume_rate_limit RPC — миграция 264.
const EMAIL_LIMIT = { max: 5, windowSeconds: 15 * 60 }
const IP_LIMIT = { max: 20, windowSeconds: 15 * 60 }

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const body = await readBody(event)
  const { email, password } = body ?? {}

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email и пароль обязательны' })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const ip = getClientIp(event)

  await enforceRateLimit(
    [
      { key: `login:email:${normalizedEmail}`, max: EMAIL_LIMIT.max, windowSeconds: EMAIL_LIMIT.windowSeconds },
      { key: `login:ip:${ip}`, max: IP_LIMIT.max, windowSeconds: IP_LIMIT.windowSeconds },
    ],
    'Слишком много попыток входа. Попробуйте через несколько минут.',
  )

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    throw createError({ statusCode: 401, message: 'Неверный email или пароль' })
  }

  const { data: existingCustomer } = await db
    .from('customers')
    .select('*')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()

  if (!existingCustomer) {
    throw createError({ statusCode: 403, message: 'Аккаунт не найден. Пожалуйста, зарегистрируйтесь.' })
  }

  return {
    customer: mapCustomer(existingCustomer),
    session: authData.session,
  }
})
