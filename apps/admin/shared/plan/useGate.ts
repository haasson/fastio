import { computed, type ComputedRef } from 'vue'
import { getPlanTierOrder } from '@fastio/shared'
import { isAuditLogEnabled } from '~/shared/utils/featureFlags'
import { ok, deny, useGateInfra } from './useGate.shared'
import { usePlanFeatures } from './usePlanFeatures'
import type { GateRegistry, GateResult, GateKey } from './useGate.types'

// Журнал действий доступен с тарифа «Старт» и выше — showcase исключён.
const AUDIT_LOG_MIN_TIER = getPlanTierOrder('start')

/**
 * Единая точка проверки доступа к фичам админки (ALL gates).
 *
 * Файл — агрегатор обеих вертикалей. Находится в allow-list ESLint барьера
 * (`docs/vertical-isolation.md`). Per-vertical-консьюмерам предпочтителен
 * `useGateRetail()` / `useGateServices()` — они дают строгую типизацию и
 * физически не пускают к гейтам чужой вертикали.
 *
 * Каждый гейт возвращает `{ enabled, reason }` — почему фича недоступна,
 * а не только true/false. Это позволяет UI показывать корректные баннеры
 * (🔒 апгрейд тарифа / 🚫 нет прав / ⚙️ модуль выключен / 🛠 нужна настройка).
 *
 * Приоритет причин: suspended → absent → flag → locked → disabled → unconfigured → forbidden.
 *
 * См. `useGate.types.ts` для контракта и списка ключей.
 */
export const useGate = (): GateRegistry => {
  const infra = useGateInfra()
  const { tenantStore, branchStore, resolved, isSuspended, isOwner, hasPermission, moduleGate, planFeatureGate, permissionGate, configGate } = infra
  const { plan: planTier } = usePlanFeatures()

  // ───── Module-based feature gates ─────

  const delivery = moduleGate('delivery')
  const pickup = moduleGate('pickup')
  const dineIn = moduleGate('dineIn')
  const kitchen = moduleGate('kitchen')
  // reservations — часть модуля «Столы» (dineIn), не отдельный тоггл.
  // viewReservations/manageReservations бэкуются этим гейтом + свой permission.
  const reservations = dineIn
  const services = moduleGate('services')
  const promotions = moduleGate('promotions')
  const modifiers = moduleGate('modifiers')
  const addons = moduleGate('addons')
  const combos = moduleGate('combos')
  const customers = moduleGate('customers')
  const branches = moduleGate('branches')
  const customRoles = moduleGate('customRoles')

  /**
   * Меню (food-каталог) — всегда доступно для food-тенантов; для services —
   * `absent`. Storefront для services-тенанта живёт в `/services/*`, а food-каталог
   * не имеет смысла. Это закрывает прямые ссылки `/menu/*` для services-тенанта.
   */
  const menu = computed<GateResult>(() => {
    if (isSuspended.value) return deny('suspended')
    if (tenantStore.isServices) return deny('absent')

    return ok()
  })

  /**
   * Меню услуг — зеркальная сущность для services-тенанта. Доступна
   * только если businessType=services и модуль `services` включён.
   */
  const serviceMenu = computed<GateResult>(() => {
    if (isSuspended.value) return deny('suspended')
    if (!tenantStore.isServices) return deny('absent')

    return services.value
  })

  /**
   * orders = delivery || pickup || services.
   * Если все каналы закрыты — выбираем actionable причину (`disabled` бьёт `locked`),
   * чтобы UI предлагал «включить модуль», а не сразу «купите тариф».
   * Это локальная инверсия глобального приоритета причин (см. useGate.types.ts).
   */
  const orders = computed<GateResult>(() => {
    if (isSuspended.value) return deny('suspended')

    if (tenantStore.isServices) return deny('disabled')
    if (delivery.value.enabled) return ok()
    if (pickup.value.enabled) return ok()

    const candidates = [delivery.value, pickup.value]
    const disabled = candidates.find((c) => c.reason === 'disabled')

    if (disabled) return disabled
    const locked = candidates.find((c) => c.reason === 'locked')

    if (locked) return locked

    return candidates[0]
  })

  // ───── Plan-only feature gates ─────

  const dashboard = planFeatureGate(() => resolved.value.modules.dashboard)
  const team = planFeatureGate(() => resolved.value.modules.team)
  const virtualCategories = planFeatureGate(() => resolved.value.menu.virtualCategories)
  const ingredients = planFeatureGate(() => resolved.value.menu.ingredients && tenantStore.tenant.menuStyle === 'food',
  )
  const telegramNotifications = planFeatureGate(() => resolved.value.site.telegramNotifications)

  // ───── Compile-time flag gates ─────

  // Журнал действий: compile-флаг + тариф «Старт»+. Showcase исключён —
  // без заказов и команды лента почти пустая, пункт только путает.
  const auditLog = computed<GateResult>(() => {
    if (!isAuditLogEnabled()) return deny('flag')
    if (isSuspended.value) return deny('suspended')
    if (getPlanTierOrder(planTier.value) < AUDIT_LOG_MIN_TIER) {
      return deny('locked', { requiredPlan: 'start' })
    }

    return ok()
  })

  // ───── Config-driven gates ─────

  const scheduledOrders = configGate(
    orders,
    () => tenantStore.tenant.orderSchedulingConfig?.enabled === true,
    '/orders/settings',
    'Включите заказы ко времени в настройках заказов.',
  )

  const kitchenAutoStatus = configGate(
    kitchen,
    () => !!tenantStore.tenant.kitchenConfig?.sourceStatusId,
    '/kitchen/settings',
    'Выберите статус, при котором заказ попадает на кухню.',
  )

  // ───── Permission-aware (view/manage) gates ─────

  const viewMenu = permissionGate(menu, 'menu.view')
  const manageMenu = permissionGate(menu, 'menu.edit')
  const viewServiceMenu = permissionGate(serviceMenu, 'menu.view')
  const manageServiceMenu = permissionGate(serviceMenu, 'menu.edit')

  const viewOrders = permissionGate(orders, 'orders.view')

  // Кухня требует одно из двух прав (как в текущем AppNav).
  const viewKitchen = computed<GateResult>(() => {
    if (isSuspended.value) return deny('suspended')
    if (!kitchen.value.enabled) return kitchen.value
    if (hasPermission('kitchen.view') || hasPermission('kitchen.overview')) return ok()

    return deny('forbidden')
  })
  // viewKitchenQueue — для табов "Кухня / Сборка" (сама очередь, требует kitchen.view).
  // viewKitchen выше — это для AppNav (любая kitchen-вкладка, kitchen.view OR kitchen.overview).
  const viewKitchenQueue = permissionGate(kitchen, 'kitchen.view')
  const viewKitchenOverview = permissionGate(kitchen, 'kitchen.overview')
  // cookKitchen — действия готовки на /kitchen/queue (взять блюдо в работу, отметить
  // готовым, вернуть). Доступ к самой странице — viewKitchenQueue; брать блюда —
  // только с kitchen.cook (повар). Сборщик/менеджер видят очередь, но не готовят.
  const cookKitchen = permissionGate(kitchen, 'kitchen.cook')

  const viewTables = permissionGate(dineIn, 'tables.view')
  const manageTables = permissionGate(dineIn, 'tables.manage')
  // История стола — часть модуля «Столы» (dineIn), отдельное право tables.history.
  const viewTableHistory = permissionGate(dineIn, 'tables.history')

  // Reservations — только для retail (бронирование столиков). Брони — часть модуля
  // «Столы»: отдельных прав нет, просмотр/управление бэкуются tables.view/tables.manage.
  const viewReservations = permissionGate(reservations, 'tables.view')
  const manageReservations = permissionGate(reservations, 'tables.manage')

  // Appointments — только для services (запись на услуги).
  // Отдельные ключи `appointments.*` — чтобы хостес с `tables.manage`
  // не получал доступ к Appointments автоматически.
  const viewAppointments = permissionGate(services, 'appointments.view')
  const manageAppointments = permissionGate(services, 'appointments.manage')

  // Сводный список визитов (`/appointments/list`, `/appointments`) — там видны
  // чужие клиенты (имя, телефон). Мастер с `view_own` (без `view_all`) сюда
  // не пускается: ему доступен только таймлайн со своими ресурсами и
  // компактная страница `/appointments/appointment/[id]` для своей услуги.
  // Backwards-compat: ни одного из ключей view_all/view_own → разрешено
  // (легаси-роли с одним `appointments.view`).
  const viewAllAppointments = computed<GateResult>(() => {
    if (isSuspended.value) return deny('suspended')
    if (!viewAppointments.value.enabled) return viewAppointments.value
    if (isOwner.value) return ok()
    const perms = tenantStore.currentPermissions

    if (perms?.['appointments.view_own'] === true && perms?.['appointments.view_all'] !== true) {
      return deny('forbidden')
    }

    return ok()
  })

  const viewPromotions = permissionGate(promotions, 'promos.view')
  const managePromotions = permissionGate(promotions, 'promos.manage')

  // Контент/настройки/команда/биллинг — без модуля (есть всегда).
  const alwaysOn = computed<GateResult>(() => isSuspended.value ? deny('suspended') : ok())
  const teamSection = permissionGate(team, 'team.manage')
  // Филиалы — только пермишен, без plan-фичи: даже на базовом тарифе доступна страница «Заведение».
  const viewBranches = permissionGate(alwaysOn, 'team.manage')
  const manageRoles = permissionGate(team, 'roles.manage')
  const viewContent = permissionGate(alwaysOn, 'content.view')
  const editContent = permissionGate(alwaysOn, 'content.edit')
  const viewSettings = permissionGate(alwaysOn, 'settings.view')
  const editSettings = permissionGate(alwaysOn, 'settings.edit')
  const viewAuditLog = permissionGate(auditLog, 'audit_log.view')
  const viewAnalytics = permissionGate(alwaysOn, 'analytics.view')
  // ВНИМАНИЕ: глушится по suspended (как все permissionGate). Для доступа к
  // биллингу — единственной фиче, нужной заблокированному тенанту, — используй
  // useCanManageBilling (без suspended-подавления), а не этот гейт.
  const manageBilling = permissionGate(alwaysOn, 'billing.manage')

  // ───── Special: branch limit ─────

  /**
   * Можно ли добавить ещё один филиал.
   * Модуль branches enabled → безлимит.
   * Модуль закрыт, но филиалов ещё нет → разрешаем создать главный (онбординг).
   * Иначе — возвращаем причину закрытости модуля (locked/disabled/absent).
   */
  const addBranch = computed<GateResult>(() => {
    if (isSuspended.value) return deny('suspended')

    const branchesGate = branches.value

    if (branchesGate.enabled) return ok()
    if (branchStore.branches.length < 1) return ok()

    return branchesGate
  })

  const registry = {
    // feature-only
    orders, delivery, pickup, dineIn,
    kitchen, reservations, services,
    promotions, modifiers, addons, combos, customers,
    menu, team, dashboard,
    branches, customRoles,
    virtualCategories, ingredients, telegramNotifications,
    auditLog,
    scheduledOrders, kitchenAutoStatus,
    // permission-aware
    viewMenu, manageMenu,
    viewServiceMenu, manageServiceMenu,
    viewOrders,
    viewKitchen, viewKitchenQueue, viewKitchenOverview, cookKitchen,
    viewTables, manageTables, viewTableHistory,
    viewReservations, manageReservations,
    viewAppointments, manageAppointments, viewAllAppointments,
    viewPromotions, managePromotions,
    viewContent, editContent,
    viewTeam: teamSection, manageTeam: teamSection, manageRoles,
    viewBranches,
    viewSettings, editSettings,
    viewAuditLog,
    viewAnalytics,
    manageBilling,
    // special
    addBranch,
  } satisfies Record<GateKey, ComputedRef<GateResult>>

  return registry
}
