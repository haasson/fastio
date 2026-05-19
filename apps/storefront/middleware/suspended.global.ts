import { defineNuxtRouteMiddleware, navigateTo, useNuxtData, useRequestEvent } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'

// PREPROD-117: глобальный page-middleware для tenant.subscription.status === 'suspended'.
// Server middleware больше не 503'ит весь запрос — иначе ломаются /api/health, /api/auth/*,
// /privacy и сама страница /suspended. Здесь редиректим только Vue-роуты на /suspended
// (API уже работает мимо page-middleware), оставляя точечный whitelist:
//
//   /suspended — сама посадочная страница с инструкцией
//   /privacy   — юридическая страница, должна быть доступна всегда
//
// Источник статуса:
//   - SSR: event.context.tenant (server middleware кладёт туда mapped tenant)
//   - Client: useNuxtData('tenant') — после первой загрузки app.vue зафетчил его
//     через useAsyncData('tenant') и кэш переехал в client. На client первая
//     загрузка через SSR-payload, на client-side навигациях — реактивный кэш.
export default defineNuxtRouteMiddleware((to) => {
  // Pathname-whitelist: страницы, которые остаются доступными при suspended.
  // /api/* не приходят сюда в принципе (page-middleware ловит только Vue-роуты).
  if (isWhitelisted(to.path)) return

  const status = readSubscriptionStatus()
  if (status === 'suspended') {
    return navigateTo('/suspended', { replace: true })
  }
})

function isWhitelisted(path: string): boolean {
  // Точные совпадения и префиксы. /privacy оставляем доступным, чтобы юзер мог
  // прочитать оферту/политику даже если заведение приостановлено.
  if (path === '/suspended') return true
  if (path === '/privacy' || path.startsWith('/privacy/')) return true
  return false
}

function readSubscriptionStatus(): string | null {
  // На SSR useNuxtData('tenant') ещё пуст — global middleware крутится до того,
  // как app.vue вызвал useAsyncData. Поэтому смотрим в event.context.tenant,
  // куда server middleware tenant.ts уже положил замапленного тенанта.
  //
  // Fail-open: если event/tenant отсутствует (неожиданный контекст вызова) —
  // вернём null и не будем редиректить. Лучше показать контент, чем устроить
  // редирект-петлю на /suspended на здоровом тенанте.
  if (import.meta.server) {
    const event = useRequestEvent()
    const tenant = event?.context.tenant as Tenant | undefined
    return tenant?.subscription?.status ?? null
  }

  // На client useAsyncData('tenant') гидрировался из SSR-payload — берём оттуда.
  const { data } = useNuxtData<Tenant>('tenant')
  return data.value?.subscription?.status ?? null
}
