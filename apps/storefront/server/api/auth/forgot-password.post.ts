import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email } = body ?? {}

  if (!email) {
    throw createError({ statusCode: 400, message: 'Email обязателен' })
  }

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)

  const url = getRequestURL(event)
  const redirectTo = `${url.origin}/reset-password`

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    throw createError({ statusCode: 400, message: error.message })
  }

  return { ok: true }
})
