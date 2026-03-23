import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Customer } from '@fastio/shared'
import { useSupabaseClient } from '~/composables/useSupabaseClient'
import { useModal } from '~/composables/useModal'

export const useAuthStore = defineStore('auth', () => {
  const customer = ref<Customer | null>(null)
  const loading = ref(false)
  const initialized = ref(false)

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
      await fetchProfile(session.access_token)
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await fetchProfile(session.access_token)
      } else if (event === 'SIGNED_OUT') {
        customer.value = null
      }
    })
  }

  async function fetchProfile(accessToken?: string) {
    try {
      const token = accessToken ?? (await useSupabaseClient().auth.getSession()).data.session?.access_token
      if (!token) return

      const result = await $fetch<{ customer: Customer }>('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      customer.value = result.customer
    } catch {
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

      customer.value = result.customer
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    const supabase = useSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()

    await $fetch('/api/auth/logout', {
      method: 'POST',
      body: { accessToken: session?.access_token },
    })

    await supabase.auth.signOut()
    customer.value = null
  }

  async function updateProfile(data: { name?: string; phone?: string }) {
    const supabase = useSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const result = await $fetch<{ customer: Customer }>('/api/customer/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}` },
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
    isAuthenticated,
    customerName,
    customerPhone,
    customerEmail,
    init,
    fetchProfile,
    login,
    register,
    logout,
    updateProfile,
    showLogin,
  }
})
