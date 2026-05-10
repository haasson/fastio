import type { ServicesGateKey } from './useGate.services'

/**
 * Карта роут → services-гейт. Используется как часть общего реестра
 * в `shared/plan/useGate.routes.ts` (агрегатор в allow-list).
 *
 * Разбито на под-роуты и корни, чтобы агрегатор мог сначала склеить ВСЕ
 * под-роуты обеих вертикалей + shared, и только потом — корни. Иначе
 * `/appointments/list` зацепился бы за корневой `/appointments`.
 */
export const SERVICES_ROUTE_SUBS: Array<[string, ServicesGateKey]> = [
  // Sub-роуты services
  ['/services/categories', 'manageServiceMenu'],
  ['/services/items', 'viewServiceMenu'],
  ['/services/tags', 'manageServiceMenu'],

  // Sub-роуты appointments (кроме settings — shared editSettings)
  ['/appointments/templates', 'manageAppointments'],
  ['/appointments/staff', 'manageAppointments'],
  ['/appointments/objects', 'manageAppointments'],
  // Сводный список визитов виден только тем, кто видит чужие записи:
  // мастер с `view_own` сюда не пускается (там чужие клиенты + телефоны).
  ['/appointments/list', 'viewAllAppointments'],
  // /appointments → редирект на /appointments/list или /appointments/timeline
  // (см. routeRules в nuxt.config). Гейтим здесь по тому же ключу.
  ['/appointments/visits', 'viewAllAppointments'],
]

export const SERVICES_ROUTE_ROOTS: Array<[string, ServicesGateKey]> = [
  ['/services', 'viewServiceMenu'],
  ['/appointments', 'viewAppointments'],
]
