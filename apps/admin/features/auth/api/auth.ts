import type { SupabaseClient } from '@supabase/supabase-js'

export const authApi = {
  signIn(sb: SupabaseClient, email: string, password: string) {
    return sb.auth.signInWithPassword({ email, password })
  },

  signUp(sb: SupabaseClient, email: string, password: string, options?: { data?: Record<string, unknown>; emailRedirectTo?: string }) {
    return sb.auth.signUp({ email, password, options })
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
