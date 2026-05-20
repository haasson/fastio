import { defineNuxtPlugin, navigateTo, useRuntimeConfig } from '#imports'
import { createClient } from '@supabase/supabase-js'
import { useAuthStore } from '~/shared/stores/auth'
import type { Database } from '~/shared/data/database.types'
import { INVITE_PENDING_KEY, RECOVERY_PENDING_KEY } from '~/shared/utils/constants'
import { reportError } from '@fastio/shared/observability'

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

  const supabase = createClient<Database>(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
  )

  const authStore = useAuthStore()

  // PREPROD-232: getSession читает из localStorage/IndexedDB и может бросить
  // (Safari private mode, кривые данные, плохой коннект в редких сценариях).
  // Это плагин — без try/catch unhandled throw валит весь bootstrap Nuxt и
  // пользователь видит белый экран вместо логина. Failing gracefully:
  // считаем сессию пустой, юзера на /login отправит middleware/auth.
  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) reportError(error, { ctx: 'plugins/supabase.client:getSession' })
    authStore.setUser(session?.user ?? null)
  } catch (e) {
    reportError(e, { ctx: 'plugins/supabase.client:getSession' })
    authStore.setUser(null)
  }

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
