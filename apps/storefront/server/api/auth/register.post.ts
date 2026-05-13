import { createClient } from '@supabase/supabase-js'
import { getTenantDb } from '../../utils/tenantDb'
import { getClientIp } from '../../utils/clientIp'
import { enforceRateLimit } from '../../utils/enforceRateLimit'
import { ensureCustomer } from '../../utils/authHelpers'

// Регистрация — редкая операция; жёсткие лимиты против spam-bomb и массового
// замусоривания auth.users. consume_rate_limit RPC — миграция 264.
const EMAIL_LIMIT = { max: 3, windowSeconds: 60 * 60 }
const IP_LIMIT = { max: 5, windowSeconds: 60 * 60 }

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const { tenantId } = db

  const body = await readBody(event)
  const { name, email, password } = body ?? {}

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email и пароль обязательны' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, message: 'Пароль должен быть не менее 6 символов' })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const ip = getClientIp(event)

  await enforceRateLimit(
    [
      { key: `register:email:${normalizedEmail}`, max: EMAIL_LIMIT.max, windowSeconds: EMAIL_LIMIT.windowSeconds },
      { key: `register:ip:${ip}`, max: IP_LIMIT.max, windowSeconds: IP_LIMIT.windowSeconds },
    ],
    'Слишком много регистраций. Попробуйте через час.',
  )

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, tenant_id: tenantId },
    },
  })

  if (authError) {
    throw createError({ statusCode: 400, message: authError.message })
  }

  if (!authData.user) {
    throw createError({ statusCode: 500, message: 'Не удалось создать аккаунт' })
  }

  // Если identities пустой — юзер уже существует в Supabase Auth (другой тенант или повторная регистрация)
  // Пробуем залогиниться с предоставленным паролем чтобы получить сессию
  let authUser = authData.user
  let session = authData.session

  if (!session || (authData.user.identities?.length ?? 0) === 0) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      throw createError({ statusCode: 400, message: 'Этот email уже используется' })
    }
    authUser = signInData.user
    session = signInData.session
  }

  // Проверяем, нет ли уже кастомера в этом тенанте
  const { data: existingCustomer } = await db
    .from('customers')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  if (existingCustomer) {
    throw createError({ statusCode: 409, message: 'Этот email уже зарегистрирован' })
  }

  const customer = await ensureCustomer(tenantId, authUser.id, { name, email })

  return {
    customer,
    session,
  }
})
