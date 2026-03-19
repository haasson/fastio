import { defineNuxtRouteMiddleware, navigateTo } from '#imports'
import { watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'
import { INVITE_PENDING_KEY } from '~/utils/constants'

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

  // Invite-flow: пока пароль не сохранён — держим юзера на /set-password
  if (sessionStorage.getItem(INVITE_PENDING_KEY) && to.path !== '/set-password') {
    return navigateTo('/set-password')
  }

  // Эти страницы обрабатывают авторизацию самостоятельно
  if (to.path === '/invite' || to.path === '/set-password' || to.path === '/no-access') return

  if (!authStore.isAuthenticated && to.path !== '/login') {
    return navigateTo('/login')
  }

  // Инициализируем tenant store при первом заходе (если авторизован)
  if (authStore.isAuthenticated) {
    const tenantStore = useTenantStore()

    if (!tenantStore.tenant && !tenantStore.loading) {
      await tenantStore.init()
    }

    // Юзер без единого тенанта — выкидываем
    if (!tenantStore.loading && tenantStore.memberships.length === 0 && to.path !== '/no-access') {
      return navigateTo('/no-access')
    }

    // Suspended: только /account/* и /suspended доступны
    if (tenantStore.tenant?.subscription?.status === 'suspended') {
      const isAllowed = to.path === '/suspended'
        || to.path.startsWith('/account')

      if (!isAllowed) {
        return navigateTo('/suspended')
      }
    }
  }
})
