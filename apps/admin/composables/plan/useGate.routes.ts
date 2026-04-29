import type { GateKey } from './useGate.types'

/**
 * Карта роут → ключ гейта для middleware прямого доступа по URL.
 *
 * Логика выбора гейта — та же, что и видимости в `AppNav.vue` (см. nav-items),
 * чтобы юзер не мог открыть по прямой ссылке то, что не видит в навигации.
 *
 * Порядок важен: более специфичные суб-роуты должны идти ПЕРЕД корневыми
 * секциями, иначе `startsWith` корня перехватит их раньше.
 */
const ROUTE_GATES: Array<[string, GateKey]> = [
  // ───── Суб-роуты со своими (более строгими) гейтами ─────
  ['/menu/categories', 'manageMenu'],
  ['/menu/modifiers', 'modifiers'],
  ['/menu/addons', 'addons'],
  ['/menu/tags', 'manageMenu'],

  ['/orders/settings', 'editSettings'],
  ['/orders/statuses', 'editSettings'],
  ['/orders/order-number', 'editSettings'],
  ['/orders/delivery', 'delivery'],

  ['/kitchen/queue', 'viewKitchenQueue'],
  ['/kitchen/assembly', 'viewKitchenQueue'],
  ['/kitchen/overview', 'viewKitchenOverview'],
  ['/kitchen/settings', 'editSettings'],

  ['/team/roles', 'manageRoles'],

  ['/reservations/settings', 'editSettings'],

  ['/appointments/settings', 'editSettings'],
  ['/appointments/templates', 'manageAppointments'],
  ['/appointments/staff', 'manageAppointments'],
  ['/appointments/objects', 'manageAppointments'],

  ['/services/categories', 'manageServiceMenu'],
  ['/services/items', 'viewServiceMenu'],
  ['/services/tags', 'manageServiceMenu'],

  // ───── Корни секций (соответствуют AppNav) ─────
  ['/menu', 'viewMenu'],
  ['/orders', 'viewOrders'],
  ['/kitchen', 'viewKitchen'],
  ['/tables', 'viewTables'],
  ['/reservations', 'viewReservations'],
  ['/appointments', 'viewAppointments'],
  ['/services', 'viewServiceMenu'],
  ['/promotions', 'managePromotions'],
  ['/team', 'manageTeam'],
  ['/branches', 'viewBranches'],
  ['/content', 'viewContent'],
  ['/appearance', 'viewContent'],
  ['/settings', 'viewSettings'],
  ['/audit-log', 'viewAuditLog'],
]

const ROOT_GATE: GateKey = 'dashboard'

/**
 * Роуты, которые middleware вообще не трогает: auth-flow, публичные документы,
 * всегда-доступные секции (личный кабинет и помощь).
 */
const UNGATED_PREFIXES = ['/login', '/invite', '/set-password', '/no-access', '/suspended', '/legal', '/account', '/help']

export const isUngatedRoute = (path: string): boolean => UNGATED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))

/**
 * Найти ключ гейта для пути. `null` — для роутов, которые не нужно гейтить
 * (или неизвестных путей: 404 пусть рендерится как есть).
 */
export const resolveRouteGate = (path: string): GateKey | null => {
  if (path === '/') return ROOT_GATE
  if (isUngatedRoute(path)) return null

  for (const [prefix, gate] of ROUTE_GATES) {
    if (path === prefix || path.startsWith(prefix + '/')) return gate
  }

  return null
}

/**
 * Кандидаты для редиректа, когда исходная страница недоступна.
 * Идём по списку и выбираем первый разрешённый — порядок отражает
 * "общую полезность" страниц (дашборд → заказы → меню → …).
 */
export const REDIRECT_FALLBACKS = [
  '/',
  '/orders',
  '/menu',
  '/services/items',
  '/kitchen',
  '/tables',
  '/reservations',
  '/appointments',
  '/promotions',
  '/branches',
  '/content',
  '/appearance',
  '/settings',
  '/team/members',
  '/audit-log',
  '/help',
  '/account/profile',
]
