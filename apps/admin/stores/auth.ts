import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@supabase/supabase-js'

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
