import { defineNuxtRouteMiddleware, navigateTo } from '#imports'
import { useAuthStore } from '~/shared/stores/auth'
import { useTenantStore } from '~/shared/stores/tenant'
import { useGate } from '~/composables/plan/useGate'
import { resolveRouteGate, isUngatedRoute, REDIRECT_FALLBACKS } from '~/composables/plan/useGate.routes'

/**
 * Закрывает прямой URL-доступ к секциям, которые недоступны юзеру
 * (модуль выключен, нет прав, тариф не позволяет, suspended и т.п.).
 *
 * Видимость в `AppNav.vue` уже завязана на `useGate` — это middleware закрывает
 * ту же дверь со стороны URL: ввёл `/tables` руками с выключенным модулем —
 * редиректнуло на дашборд (или другую доступную секцию).
 *
 * Запускается ПОСЛЕ `auth.global.ts` (по алфавиту: auth → gate), значит
 * tenant-store к этому моменту уже инициализирован.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) return

  const tenantStore = useTenantStore()

  // Без тенанта гейты бессмысленны — auth.global уже выкинет на /no-access или /login.
  if (!tenantStore.maybeTenant) return

  // Suspended-флоу полностью на auth.global: он пускает только /account/* и /suspended.
  // Гейту тут делать нечего, иначе будет двойной редирект (gate → /help → auth → /suspended).
  if (tenantStore.maybeTenant.subscription?.status === 'suspended') return

  if (isUngatedRoute(to.path)) return

  const gateKey = resolveRouteGate(to.path)

  // Незнакомый роут (например 404) — пусть Nuxt сам рендерит.
  if (!gateKey) return

  const gate = useGate()

  if (gate[gateKey].value.enabled) return

  // Ищем первый доступный fallback, кроме самого закрытого пути.
  for (const candidate of REDIRECT_FALLBACKS) {
    if (candidate === to.path) continue
    if (isUngatedRoute(candidate)) return navigateTo(candidate)

    const candidateKey = resolveRouteGate(candidate)

    if (!candidateKey || gate[candidateKey].value.enabled) return navigateTo(candidate)
  }

  return navigateTo('/account/profile')
})
