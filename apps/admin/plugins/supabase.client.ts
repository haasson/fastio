import { defineNuxtPlugin, navigateTo, useRuntimeConfig } from '#imports'
import { createClient } from '@supabase/supabase-js'
import { useAuthStore } from '~/shared/stores/auth'
import { INVITE_PENDING_KEY, RECOVERY_PENDING_KEY } from '~/utils/constants'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()

  // Читаем хеш до createClient — Supabase может очистить его при инициализации.
  // sessionStorage надёжнее стора: не затрагивается Supabase и SSR-гидрацией.
  if (window.location.hash.includes('type=invite')) {
    sessionStorage.setItem(INVITE_PENDING_KEY, '1')
  }
  if (window.location.hash.includes('type=recovery')) {
    sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
  }

  const supabase = createClient(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
  )

  const authStore = useAuthStore()

  // Получаем текущую сессию при старте
  const { data: { session } } = await supabase.auth.getSession()

  authStore.setUser(session?.user ?? null)

  // Слушаем изменения состояния авторизации
  supabase.auth.onAuthStateChange((event, session) => {
    authStore.setUser(session?.user ?? null)
    if (event === 'SIGNED_OUT') {
      navigateTo('/login')
    }
  })

  return {
    provide: { supabase },
  }
})
