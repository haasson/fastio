import { defineNuxtRouteMiddleware, navigateTo } from '#imports'
import { watch } from 'vue'
import { useAuthStore } from '~/shared/stores/auth'
import { useTenantStore } from '~/shared/stores/tenant'
import { INVITE_PENDING_KEY } from '~/shared/utils/constants'

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

  // Эти страницы обрабатывают авторизацию самостоятельно.
  // /no-access сюда НЕ входит намеренно: иначе при восстановлении доступа
  // (разблокировали участника / вернули в тенант) рефреш /no-access выходил бы
  // раньше tenantStore.init() и юзер навсегда застревал на странице запрета.
  if (to.path === '/invite' || to.path === '/set-password') return

  // Публичные документы — доступны без авторизации
  if (to.path.startsWith('/legal/')) return

  if (!authStore.isAuthenticated && to.path !== '/login') {
    return navigateTo('/login')
  }

  // Инициализируем tenant store при первом заходе (если авторизован)
  if (authStore.isAuthenticated) {
    const tenantStore = useTenantStore()

    if (!tenantStore.maybeTenant && !tenantStore.loading) {
      await tenantStore.init()
    } else if (tenantStore.loading) {
      await new Promise<void>((resolve) => {
        const unwatch = watch(
          () => tenantStore.loading,
          (loading) => {
            if (!loading) {
              unwatch()
              resolve()
            }
          },
        )
      })
    }

    // Юзер без единого тенанта — выкидываем
    if (tenantStore.memberships.length === 0 && to.path !== '/no-access') {
      return navigateTo('/no-access')
    }

    // Доступ восстановлен (разблокировали участника / вернули в тенант) — уводим
    // обратно в админку, иначе юзер залипает на /no-access после init.
    if (tenantStore.memberships.length > 0 && to.path === '/no-access') {
      return navigateTo('/')
    }

    // Suspended: доступны только /suspended, /account/* (оплата) и /help/* (помощь
    // и форма поддержки — нужна даже на заблокированном тенанте).
    if (tenantStore.maybeTenant?.subscription?.status === 'suspended') {
      const isAllowed = to.path === '/suspended'
        || to.path.startsWith('/account')
        || to.path.startsWith('/help')

      if (!isAllowed) {
        return navigateTo('/suspended')
      }
    }
  }
})
