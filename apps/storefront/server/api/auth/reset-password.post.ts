import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { accessToken, password } = body ?? {}

  if (!accessToken || !password) {
    throw createError({ statusCode: 400, message: 'Токен и новый пароль обязательны' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, message: 'Пароль должен быть не менее 6 символов' })
  }

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
