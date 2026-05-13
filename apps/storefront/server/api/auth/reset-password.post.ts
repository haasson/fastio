import { createClient } from '@supabase/supabase-js'
import { getClientIp } from '../../utils/clientIp'
import { enforceRateLimit } from '../../utils/enforceRateLimit'

// Per-IP лимит на смену пароля. accessToken сам по себе криптографический (Supabase JWT),
// но лимит закрывает брут утёкших/угаданных recovery-токенов с одного хоста.
// consume_rate_limit RPC — миграция 264.
const IP_LIMIT = { max: 10, windowSeconds: 10 * 60 }

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { accessToken, password } = body ?? {}

  if (!accessToken || !password) {
    throw createError({ statusCode: 400, message: 'Токен и новый пароль обязательны' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, message: 'Пароль должен быть не менее 6 символов' })
  }

  const ip = getClientIp(event)

  await enforceRateLimit(
    [{ key: `reset-password:ip:${ip}`, max: IP_LIMIT.max, windowSeconds: IP_LIMIT.windowSeconds }],
    'Слишком много запросов. Попробуйте через несколько минут.',
  )

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    throw createError({ statusCode: 400, message: error.message })
  }

  return { ok: true }
})
