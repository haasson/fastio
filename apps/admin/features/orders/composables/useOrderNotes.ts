import { ref, type Ref } from 'vue'
import type { OrderNote } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { useAuthStore } from '~/shared/stores/auth'
import { useTenantStore } from '~/shared/stores/tenant'

export const useOrderNotes = (orderId: Ref<string>, tenantId: Ref<string>) => {
  const api = useDatabase()
  const authStore = useAuthStore()
  const tenantStore = useTenantStore()

  const notes = ref<OrderNote[]>([])
  const loading = ref(false)

  const fetch = async () => {
    loading.value = true
    notes.value = await api.orderNotes.list(orderId.value)
    loading.value = false
  }

  const add = async (content: string) => {
    if (!authStore.user) return

    const note = await api.orderNotes.add({
      orderId: orderId.value,
      tenantId: tenantId.value,
      authorId: authStore.user.id,
      authorName: authStore.user.email ?? 'Оператор',
      authorRole: tenantStore.currentRoleName ?? 'Сотрудник',
      content,
    })

    if (note) notes.value.push(note)
  }

  return { notes, loading, fetch, add }
}
