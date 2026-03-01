import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import type { Dish } from '@fastfood-saas/shared'

export type DishFormData = Omit<Dish, 'id' | 'tenantId' | 'photos'>

export function useDishes(tenantId: string, categoryId: Ref<string | null>) {
  const { $db } = useNuxtApp()
  const dishes = ref<Dish[]>([])
  const loading = ref(false)

  let unsubscribe: (() => void) | null = null

  const col = collection($db, 'tenants', tenantId, 'dishes')

  watch(
    categoryId,
    (id) => {
      unsubscribe?.()
      dishes.value = []

      if (!id) return

      loading.value = true
      unsubscribe = onSnapshot(
        query(col, where('categoryId', '==', id), orderBy('order')),
        (snap) => {
          dishes.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dish)
          loading.value = false
        },
      )
    },
    { immediate: true },
  )

  onUnmounted(() => unsubscribe?.())

  async function add(data: DishFormData) {
    const order = dishes.value.length
    await addDoc(col, { tenantId, ...data, photos: [], order })
  }

  async function update(id: string, data: Partial<DishFormData>) {
    await updateDoc(doc($db, 'tenants', tenantId, 'dishes', id), data)
  }

  async function remove(id: string) {
    await deleteDoc(doc($db, 'tenants', tenantId, 'dishes', id))
  }

  async function toggleActive(id: string, active: boolean) {
    await updateDoc(doc($db, 'tenants', tenantId, 'dishes', id), { active })
  }

  return { dishes, loading, add, update, remove, toggleActive }
}
