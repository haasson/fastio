import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Customer } from '@fastio/shared'
import { useSupabaseClient } from '~/shared/composables/useSupabaseClient'
import { useModal } from '~/shared/composables/useModal'
import { reportError } from '~/shared/utils/reportError'

type AuthMode = 'tg' | 'supabase' | null

export const useAuthStore = defineStore('auth', () => {
  const customer = ref<Customer | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  const authMode = ref<AuthMode>(null)

  const isAuthenticated = computed(() => !!customer.value)
  const customerName = computed(() => customer.value?.name ?? '')
  const customerPhone = computed(() => customer.value?.phone ?? '')
  const customerEmail = computed(() => customer.value?.email ?? '')

  async function init() {
    if (initialized.value || !import.meta.client) return
    initialized.value = true

    const supabase = useSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      authMode.value = 'supabase'
      await fetchProfile()
    } else {
      // No Supabase session — try to resolve via tg cookie. Server returns 401 if absent or expired.
      await fetchProfile()
      if (customer.value) authMode.value = 'tg'
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        authMode.value = 'supabase'
        await fetchProfile()
      } else if (event === 'SIGNED_OUT') {
        // Supabase emits SIGNED_OUT even when nobody was signed in via Supabase
        // (e.g. on first load with only a tg cookie). Only clear when WE were the supabase user.
        if (authMode.value === 'supabase') {
          customer.value = null
          authMode.value = null
        }
      }
    })
  }

  async function fetchProfile() {
    try {
      const headers: Record<string, string> = {}
      const supabaseToken = await getSupabaseToken()
      if (supabaseToken) headers.Authorization = `Bearer ${supabaseToken}`

      const result = await $fetch<{ customer: Customer }>('/api/auth/me', { headers })
      customer.value = result.customer
    } catch (err) {
      const status = (err as { status?: number; statusCode?: number }).status
        ?? (err as { statusCode?: number }).statusCode
      // 401 just means «not signed in» — expected on guest pageviews, don't pollute Sentry.
      if (status !== 401 && status !== 404) reportError(err)
      customer.value = null
    }
  }

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const result = await $fetch<{ customer: Customer; session: { access_token: string; refresh_token: string } }>(
        '/api/auth/login',
        { method: 'POST', body: { email, password } },
      )

      const supabase = useSupabaseClient()
      await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      })

      authMode.value = 'supabase'
      customer.value = result.customer
    } finally {
      loading.value = false
    }
  }

  async function register(name: string, email: string, password: string) {
    loading.value = true
    try {
      const result = await $fetch<{ customer: Customer; session: { access_token: string; refresh_token: string } }>(
        '/api/auth/register',
        { method: 'POST', body: { name, email, password } },
      )

      if (result.session) {
        const supabase = useSupabaseClient()
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        })
      }

      authMode.value = 'supabase'
      customer.value = result.customer
    } finally {
      loading.value = false
    }
  }

  /** Called after a successful Telegram login; the cookie is already set by the server. */
  async function loginWithTelegram() {
    authMode.value = 'tg'
    await fetchProfile()
  }

  async function logout() {
    const supabaseToken = await getSupabaseToken()
    await $fetch('/api/auth/logout', {
      method: 'POST',
      body: { accessToken: supabaseToken },
    })

    if (authMode.value === 'supabase' || supabaseToken) {
      await useSupabaseClient().auth.signOut()
    }

    customer.value = null
    authMode.value = null
  }

  async function updateProfile(data: { name?: string; phone?: string }) {
    const headers: Record<string, string> = {}
    const supabaseToken = await getSupabaseToken()
    if (supabaseToken) headers.Authorization = `Bearer ${supabaseToken}`

    const result = await $fetch<{ customer: Customer }>('/api/customer/profile', {
      method: 'PATCH',
      headers,
      body: data,
    })
    customer.value = result.customer
  }

  function showLogin() {
    useModal('auth-login').open()
  }

  return {
    customer,
    loading,
    initialized,
    authMode,
    isAuthenticated,
    customerName,
    customerPhone,
    customerEmail,
    init,
    fetchProfile,
    login,
    loginWithTelegram,
    register,
    logout,
    updateProfile,
    showLogin,
  }
})

// Returns a Supabase access token if present. TG sessions don't use Authorization headers — the
// HttpOnly cookie travels with $fetch automatically — so callers just attach the header conditionally.
async function getSupabaseToken(): Promise<string | undefined> {
  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}
