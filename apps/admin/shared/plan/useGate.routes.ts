import { RETAIL_ROUTE_SUBS, RETAIL_ROUTE_ROOTS } from '~/shared/plan/useGate.retail.routes'
import { SERVICES_ROUTE_SUBS, SERVICES_ROUTE_ROOTS } from '~/shared/plan/useGate.services.routes'
import type { GateKey } from './useGate.types'

/**
 * Карта роут → ключ гейта для middleware прямого доступа по URL.
 *
 * Логика выбора гейта — та же, что и видимости в `AppNav.vue` (см. nav-items),
 * чтобы юзер не мог открыть по прямой ссылке то, что не видит в навигации.
 *
 * Структура: сначала ВСЕ под-роуты (retail + services + shared), потом ВСЕ
 * корни. `startsWith`-сматчинг иначе перехватил бы под-роут корнем секции.
 *
 * Per-vertical карты лежат в `composables/{retail,services}/useGate.routes.ts`,
 * чтобы их типы (RetailGateKey/ServicesGateKey) физически не давали
 * перепутать вертикали при добавлении новых роутов.
 */
const ROUTE_GATES: Array<[string, GateKey]> = [
  // ───── Под-роуты вертикалей ─────
  ...RETAIL_ROUTE_SUBS,
  ...SERVICES_ROUTE_SUBS,

  // ───── Shared под-роуты (settings/* мапятся на shared editSettings) ─────
  ['/orders/settings', 'editSettings'],
  ['/orders/statuses', 'editSettings'],
  ['/orders/order-number', 'editSettings'],
  ['/kitchen/settings', 'editSettings'],
  ['/reservations/settings', 'editSettings'],
  ['/appointments/settings', 'editSettings'],
  ['/team/roles', 'manageRoles'],

  // ───── Корни секций (соответствуют AppNav) ─────
  ...RETAIL_ROUTE_ROOTS,
  ...SERVICES_ROUTE_ROOTS,
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
  // `/appointments/timeline` идёт ДО `/appointments` — у мастера с `view_own`
  // сводный список (`/appointments/list`) закрыт `viewAllAppointments`-гейтом,
  // а routeRule `/appointments → /appointments/list` приведёт обратно в гейт
  // (бесконечный редирект). Таймлайн ему доступен и не имеет routeRule.
  '/appointments/timeline',
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
