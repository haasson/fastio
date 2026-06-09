import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CustomerAddress } from '@fastio/shared'
import { useSupabaseClient } from '~/shared/composables/useSupabaseClient'
import { reportError } from '@fastio/shared/observability'

export const useAddressesStore = defineStore('addresses', () => {
  const addresses = ref<CustomerAddress[]>([])
  const loading = ref(true)

  // TG-юзеры авторизованы httpOnly cookie tg_session — браузер шлёт её автоматически.
  // Bearer нужен только для Supabase-сессии (email/password). Если сессии нет — просто
  // пустые заголовки: сервер сам разберётся (cookie-first в getAuthenticatedContext).
  async function authHeaders(): Promise<Record<string, string>> {
    const supabase = useSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  async function fetch() {
    loading.value = true
    try {
      addresses.value = await $fetch<CustomerAddress[]>('/api/customer/addresses', {
        headers: await authHeaders(),
      })
    } catch (e) {
      reportError(e, { context: 'addresses:fetch' })
      addresses.value = []
    } finally {
      loading.value = false
    }
  }

  async function add(address: Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt'>) {
    const created = await $fetch<CustomerAddress>('/api/customer/addresses', {
      method: 'POST',
      headers: await authHeaders(),
      body: address,
    })
    addresses.value.push(created)
    return created
  }

  async function update(id: string, data: Partial<Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt'>>) {
    const updated = await $fetch<CustomerAddress>(`/api/customer/addresses/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: data,
    })
    const idx = addresses.value.findIndex((a) => a.id === id)
    if (idx !== -1) addresses.value[idx] = updated
    return updated
  }

  async function remove(id: string) {
    await $fetch(`/api/customer/addresses/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    addresses.value = addresses.value.filter((a) => a.id !== id)
  }

  return { addresses, loading, fetch, add, update, remove }
})
