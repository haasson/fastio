import { defineNuxtRouteMiddleware, navigateTo } from '#imports'
import { watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const authStore = useAuthStore()

  // Ждём пока плагин инициализирует состояние авторизации (первая загрузка)
  if (authStore.loading) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => authStore.loading,
        (loading) => {
          if (!loading) {
            unwatch()
            resolve()
          }
        },
      )
    })
  }

  // /invite обрабатывает авторизацию самостоятельно
  if (to.path === '/invite') return

  if (!authStore.isAuthenticated && to.path !== '/login') {
    return navigateTo('/login')
  }

  // Инициализируем tenant store при первом заходе (если авторизован)
  if (authStore.isAuthenticated) {
    const tenantStore = useTenantStore()

    if (!tenantStore.tenant && !tenantStore.loading) {
      await tenantStore.init()
    }
  }
})
