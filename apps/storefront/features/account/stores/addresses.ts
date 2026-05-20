import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CustomerAddress } from '@fastio/shared'
import { useSupabaseClient } from '~/shared/composables/useSupabaseClient'
import { reportError } from '@fastio/shared/observability'
import { NotAuthenticatedError } from '~/shared/utils/errors'

export const useAddressesStore = defineStore('addresses', () => {
  const addresses = ref<CustomerAddress[]>([])
  const loading = ref(true)

  async function getAuthHeader() {
    const supabase = useSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new NotAuthenticatedError()
    return { Authorization: `Bearer ${session.access_token}` }
  }

  async function fetch() {
    loading.value = true
    try {
      const headers = await getAuthHeader()
      addresses.value = await $fetch<CustomerAddress[]>('/api/customer/addresses', { headers })
    } catch (e) {
      // Гость (нет сессии) — by design, не логируем. Sentinel-класс вместо message-
      // сравнения, чтобы локализация / переименование текста не сломали guard.
      if (!(e instanceof NotAuthenticatedError)) {
        reportError(e, { context: 'addresses:fetch' })
      }
      addresses.value = []
    } finally {
      loading.value = false
    }
  }

  async function add(address: Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt'>) {
    const headers = await getAuthHeader()
    const created = await $fetch<CustomerAddress>('/api/customer/addresses', {
      method: 'POST',
      headers,
      body: address,
    })
    addresses.value.push(created)
    return created
  }

  async function update(id: string, data: Partial<Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt'>>) {
    const headers = await getAuthHeader()
    const updated = await $fetch<CustomerAddress>(`/api/customer/addresses/${id}`, {
      method: 'PATCH',
      headers,
      body: data,
    })
    const idx = addresses.value.findIndex((a) => a.id === id)
    if (idx !== -1) addresses.value[idx] = updated
    return updated
  }

  async function remove(id: string) {
    const headers = await getAuthHeader()
    await $fetch(`/api/customer/addresses/${id}`, {
      method: 'DELETE',
      headers,
    })
    addresses.value = addresses.value.filter((a) => a.id !== id)
  }

  return { addresses, loading, fetch, add, update, remove }
})
