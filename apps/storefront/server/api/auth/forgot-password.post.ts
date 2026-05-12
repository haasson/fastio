import type { H3Event } from 'h3'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '../../utils/supabase'
import { reportError } from '~/shared/utils/reportError'

// Public endpoint: критично защититься от email-bomb (атакующий шлёт N запросов с email жертвы),
// поэтому лимит — durable, per-email. Per-IP — вторичная защита: атакующий может ротировать IP
// через подделку X-Forwarded-For, если перед нами не trusted proxy.
const EMAIL_LIMIT = { max: 3, windowSeconds: 10 * 60 }
const IP_LIMIT = { max: 10, windowSeconds: 10 * 60 }

/**
 * IP клиента. На Vercel `x-real-ip` ставится платформой и подделать его через
 * пользовательский заголовок нельзя. Если приложение задеплоено без trusted proxy,
 * `getRequestIP(xForwardedFor)` фолбэчится на socket.remoteAddress, что тоже OK.
 */
function getClientIp(event: H3Event): string {
  return getHeader(event, 'x-real-ip') ?? getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email } = body ?? {}

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, message: 'Некорректный email' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const ip = getClientIp(event)
  const admin = getServerSupabase()

  const [{ data: emailOk }, { data: ipOk }] = await Promise.all([
    admin.rpc('consume_rate_limit', {
      _key: `forgot-password:email:${normalizedEmail}`,
      _max: EMAIL_LIMIT.max,
      _window_seconds: EMAIL_LIMIT.windowSeconds,
    }),
    admin.rpc('consume_rate_limit', {
      _key: `forgot-password:ip:${ip}`,
      _max: IP_LIMIT.max,
      _window_seconds: IP_LIMIT.windowSeconds,
    }),
  ])

  if (emailOk === false || ipOk === false) {
    throw createError({ statusCode: 429, message: 'Слишком много запросов. Попробуйте через несколько минут.' })
  }

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
