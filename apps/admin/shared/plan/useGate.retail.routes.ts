import type { RetailGateKey } from './useGate.retail'

/**
 * Карта роут → retail-гейт. Используется как часть общего реестра
 * в `shared/plan/useGate.routes.ts` (агрегатор в allow-list).
 *
 * Разбито на под-роуты и корни, чтобы агрегатор мог сначала склеить ВСЕ
 * под-роуты обеих вертикалей + shared, и только потом — корни. Иначе
 * `/orders/settings` зацепился бы за корневой `/orders` (`startsWith`).
 */
export const RETAIL_ROUTE_SUBS: Array<[string, RetailGateKey]> = [
  // Sub-роуты menu
  ['/menu/categories', 'manageMenu'],
  ['/menu/modifiers', 'modifiers'],
  ['/menu/addons', 'addons'],
  ['/menu/tags', 'manageMenu'],

  // Sub-роуты orders (кроме settings — те идут через shared editSettings в общем реестре)
  ['/orders/delivery', 'delivery'],

  // Sub-роуты kitchen (кроме settings)
  ['/kitchen/queue', 'viewKitchenQueue'],
  ['/kitchen/assembly', 'viewKitchenQueue'],
  ['/kitchen/overview', 'viewKitchenOverview'],
]

export const RETAIL_ROUTE_ROOTS: Array<[string, RetailGateKey]> = [
  ['/menu', 'viewMenu'],
  ['/orders', 'viewOrders'],
  ['/kitchen', 'viewKitchen'],
  ['/tables', 'viewTables'],
  ['/reservations', 'viewReservations'],
  ['/promotions', 'managePromotions'],
]
