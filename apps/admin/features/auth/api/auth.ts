import type { SupabaseClient } from '@supabase/supabase-js'

// authApi.signUp удалён: client-side signUp в admin приглашал orphan auth.users
// в обход проверок. Создание admin-юзера через invite-flow идёт через server-side
// edge function `accept-invite` (admin.createUser), что позволяет безопасно
// выставить GOTRUE_DISABLE_SIGNUP=true в GoTrue.
export const authApi = {
  signIn(sb: SupabaseClient, email: string, password: string) {
    return sb.auth.signInWithPassword({ email, password })
  },

  signOut(sb: SupabaseClient) {
    return sb.auth.signOut()
  },

  getSession(sb: SupabaseClient) {
    return sb.auth.getSession()
  },

  async getAccessToken(sb: SupabaseClient): Promise<string | null> {
    const { data: { session } } = await sb.auth.getSession()

    return session?.access_token ?? null
  },

  updateUser(sb: SupabaseClient, attrs: { password?: string; data?: Record<string, unknown> }) {
    return sb.auth.updateUser(attrs)
  },
}
