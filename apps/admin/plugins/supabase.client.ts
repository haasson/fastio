import { createClient } from '@supabase/supabase-js'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()

  const supabase = createClient(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
  )

  const authStore = useAuthStore()

  // Получаем текущую сессию при старте
  const { data: { session } } = await supabase.auth.getSession()
  authStore.setUser(session?.user ?? null)

  // Слушаем изменения состояния авторизации
  supabase.auth.onAuthStateChange((_, session) => {
    authStore.setUser(session?.user ?? null)
  })

  return {
    provide: { supabase },
  }
})
