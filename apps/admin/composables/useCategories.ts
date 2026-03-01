import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore'
import type { Category } from '@fastfood-saas/shared'

export function useCategories(tenantId: Ref<string>) {
  const { $db } = useNuxtApp()
  const categories = ref<Category[]>([])
  const loading = ref(true)

  let unsubscribe: (() => void) | null = null

  watch(
    tenantId,
    (id) => {
      unsubscribe?.()
      if (!id) return

      const col = collection($db, 'tenants', id, 'categories')
      loading.value = true
      unsubscribe = onSnapshot(query(col, orderBy('order')), (snap) => {
        categories.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category)
        loading.value = false
      })
    },
    { immediate: true },
  )

  onUnmounted(() => unsubscribe?.())

  async function add(name: string) {
    const id = tenantId.value
    if (!id) return
    const col = collection($db, 'tenants', id, 'categories')
    const order = categories.value.length
    await addDoc(col, { tenantId: id, name, order, active: true })
  }

  async function update(id: string, data: Partial<Pick<Category, 'name' | 'active' | 'order'>>) {
    await updateDoc(doc($db, 'tenants', tenantId.value, 'categories', id), data)
  }

  async function remove(id: string) {
    await deleteDoc(doc($db, 'tenants', tenantId.value, 'categories', id))
  }

  return { categories, loading, add, update, remove }
}
