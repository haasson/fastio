import { createClient } from '@supabase/supabase-js'
import { getClientIp } from '../../utils/clientIp'
import { enforceRateLimit } from '../../utils/enforceRateLimit'
import { reportError } from '~/shared/utils/reportError'

// Public endpoint: критично защититься от email-bomb (атакующий шлёт N запросов с email жертвы),
// поэтому лимит — durable, per-email. Per-IP — вторичная защита (см. getClientIp + TRUST_PROXY).
const EMAIL_LIMIT = { max: 3, windowSeconds: 10 * 60 }
const IP_LIMIT = { max: 10, windowSeconds: 10 * 60 }

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email } = body ?? {}

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, message: 'Некорректный email' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const ip = getClientIp(event)

  await enforceRateLimit(
    [
      { key: `forgot-password:email:${normalizedEmail}`, max: EMAIL_LIMIT.max, windowSeconds: EMAIL_LIMIT.windowSeconds },
      { key: `forgot-password:ip:${ip}`, max: IP_LIMIT.max, windowSeconds: IP_LIMIT.windowSeconds },
    ],
    'Слишком много запросов. Попробуйте через несколько минут.',
  )

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)

  const url = getRequestURL(event)
  const redirectTo = `${url.origin}/reset-password`

  const { error } = await supabase.functions.invoke('send-recovery-email', {
    body: { email: normalizedEmail, redirectTo },
  })

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Не удалось отправить письмо' })
  }

  return { ok: true }
})
