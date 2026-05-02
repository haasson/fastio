import { createClient } from '@supabase/supabase-js'
import { mapCustomer } from '../../utils/supabase'
import { getTenantDb } from '../../utils/tenantDb'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const body = await readBody(event)
  const { email, password } = body ?? {}

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email и пароль обязательны' })
  }

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
