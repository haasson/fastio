import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!user.value)

  function setUser(u: User | null) {
    user.value = u
    loading.value = false
  }

  return { user, loading, isAuthenticated, setUser }
})
