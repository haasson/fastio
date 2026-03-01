import { defineStore } from 'pinia'
import { collection, query, where, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import type { Tenant } from '@fastfood-saas/shared'
import { useAuthStore } from './auth'

export const useTenantStore = defineStore('tenant', () => {
  const tenant = ref<Tenant | null>(null)
  const loading = ref(false)
  let unsubscribe: (() => void) | null = null

  async function init() {
    const { $db } = useNuxtApp()
    const authStore = useAuthStore()

    if (!authStore.user) return

    loading.value = true

    const q = query(
      collection($db, 'tenants'),
      where('ownerId', '==', authStore.user.uid),
      limit(1),
    )

    unsubscribe = onSnapshot(q, (snap) => {
      if (snap.empty) {
        tenant.value = null
      } else {
        const doc = snap.docs[0]
        tenant.value = { id: doc.id, ...doc.data() } as Tenant
      }
      loading.value = false
    })
  }

  async function update(data: Partial<Omit<Tenant, 'id'>>) {
    if (!tenant.value) return
    const { $db } = useNuxtApp()
    await updateDoc(doc($db, 'tenants', tenant.value.id), data)
  }

  function dispose() {
    unsubscribe?.()
    unsubscribe = null
    tenant.value = null
  }

  return { tenant, loading, init, update, dispose }
})
