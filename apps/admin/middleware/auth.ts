import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const authStore = useAuthStore()

  // Ждём пока Firebase вернёт состояние авторизации (первая загрузка)
  if (authStore.loading) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => authStore.loading,
        (loading) => {
          if (!loading) {
            unwatch()
            resolve()
          }
        }
      )
    })
  }

  if (!authStore.isAuthenticated && to.path !== '/login') {
    return navigateTo('/login')
  }
})
