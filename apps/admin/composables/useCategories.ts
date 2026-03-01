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

export function useCategories(tenantId: string) {
  const { $db } = useNuxtApp()
  const categories = ref<Category[]>([])
  const loading = ref(true)

  const col = collection($db, 'tenants', tenantId, 'categories')

  const unsubscribe = onSnapshot(query(col, orderBy('order')), (snap) => {
    categories.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category)
    loading.value = false
  })

  onUnmounted(unsubscribe)

  async function add(name: string) {
    const order = categories.value.length
    await addDoc(col, { tenantId, name, order, active: true })
  }

  async function update(id: string, data: Partial<Pick<Category, 'name' | 'active' | 'order'>>) {
    await updateDoc(doc($db, 'tenants', tenantId, 'categories', id), data)
  }

  async function remove(id: string) {
    await deleteDoc(doc($db, 'tenants', tenantId, 'categories', id))
  }

  return { categories, loading, add, update, remove }
}
