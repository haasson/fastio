import { computed, type ComputedRef } from 'vue'
import type { PermissionKey } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useResolvedFeatures } from './useResolvedFeatures'
import { useModules, useModuleConfigs } from './useModules'
import { AUDIT_LOG_ENABLED } from '~/utils/featureFlags'
import type { ModuleKey } from '~/config/modules'
import type { GateRegistry, GateResult, GateKey, GateReason } from './useGate.types'

const ok = (): GateResult => ({ enabled: true, reason: null })

const deny = (reason: Exclude<GateReason, null>, extra: Partial<GateResult> = {}): GateResult => ({ enabled: false, reason, ...extra })

/**
 * Единая точка проверки доступа к фичам админки.
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
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()
  const { resolved } = useResolvedFeatures()
  const modules = useModules()
  const { configs: moduleConfigs } = useModuleConfigs()

  // ───── Глобальные предикаты ─────

  /** Подписка приостановлена — кроме /account/* всё закрыто. */
  const isSuspended = computed(() => tenantStore.maybeTenant?.subscription?.status === 'suspended')

  /** Owner проходит любые role-checks. */
  const isOwner = computed(() => tenantStore.isOwner)

  const hasPermission = (key: PermissionKey): boolean => {
    if (isOwner.value) return true
    const perms = tenantStore.currentPermissions

    return perms?.[key] === true
  }

  /** Найти required-plan модуля для отображения в lock-баннере. */
  const requiredPlanFor = (moduleKey: ModuleKey): string | undefined => moduleConfigs.value.find((c) => c.key === moduleKey)?.requiredPlan

  // ───── Билдеры ─────

  /**
   * Гейт "фича существует на уровне тенанта" (без role-check).
   * Учитывает: suspended → absent → locked → disabled.
   */
  const moduleGate = (key: ModuleKey): ComputedRef<GateResult> => computed(() => {
    if (isSuspended.value) return deny('suspended')

    const state = modules[key].value

    if (state.absent) return deny('absent')
    if (state.locked) return deny('locked', { requiredPlan: requiredPlanFor(key) })
    if (!state.active) return deny('disabled')

    return ok()
  })

  /**
   * Гейт plan-only фичи (нет в TenantModules, не переключается вручную).
   * Учитывает: suspended → locked. Без absent/disabled.
   */
  const planFeatureGate = (
    has: () => boolean,
    requiredPlan?: string,
  ): ComputedRef<GateResult> => computed(() => {
    if (isSuspended.value) return deny('suspended')
    if (!has()) return deny('locked', requiredPlan ? { requiredPlan } : {})

    return ok()
  })

  /**
   * Гейт компиляционного флага. Без suspended (это не доступ — это сборка).
   */
  const flagGate = (enabled: boolean): ComputedRef<GateResult> => computed(() => enabled ? ok() : deny('flag'),
  )

  /**
   * Permission-aware гейт: feature-gate + role-check.
   * Если фича недоступна на уровне тенанта — возвращаем причину тенанта.
   * Если доступна, но нет права роли — forbidden.
   */
  const permissionGate = (
    feature: ComputedRef<GateResult>,
    permKey: PermissionKey,
  ): ComputedRef<GateResult> => computed(() => {
    if (isSuspended.value) return deny('suspended')
    if (!feature.value.enabled) return feature.value
    if (!hasPermission(permKey)) return deny('forbidden')

    return ok()
  })

  /**
   * Гейт config-driven фичи: фича включается настройкой тенанта.
   * Учитывает: suspended → absent (через зависимый module) → locked → disabled →
   * unconfigured (если зависимый module enabled, но настройка не включена).
   */
  const configGate = (
    dependsOn: ComputedRef<GateResult>,
    isConfigured: () => boolean,
    configPath: string,
    hint: string,
  ): ComputedRef<GateResult> => computed(() => {
    if (isSuspended.value) return deny('suspended')
    if (!dependsOn.value.enabled) return dependsOn.value
    if (!isConfigured()) return deny('unconfigured', { configPath, hint })

    return ok()
  })

  // ───── Module-based feature gates ─────

  const delivery = moduleGate('delivery')
  const pickup = moduleGate('pickup')
  const dineIn = moduleGate('dineIn')
  const kitchen = moduleGate('kitchen')
  const reservations = moduleGate('reservations')
  const services = moduleGate('services')
  const promotions = moduleGate('promotions')
  const modifiers = moduleGate('modifiers')
  const addons = moduleGate('addons')
  const combos = moduleGate('combos')
  const customers = moduleGate('customers')
  const branchesNotNeeded = computed(() => tenantStore.maybeTenant?.onboardingState?.branchNotNeeded === true)
  const branchesModule = moduleGate('branches')
  const branches = computed<GateResult>(() => branchesNotNeeded.value ? deny('opted-out') : branchesModule.value)
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

  const auditLog = flagGate(AUDIT_LOG_ENABLED)

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

  const viewTables = permissionGate(dineIn, 'tables.view')
  const manageTables = permissionGate(dineIn, 'tables.manage')

  // Reservations — только для retail (бронирование столиков).
  const viewReservations = permissionGate(reservations, 'reservations.view')
  const manageReservations = permissionGate(reservations, 'reservations.manage')

  // Appointments — только для services (запись на услуги).
  // Отдельные ключи `appointments.*` — чтобы хостес со `reservations.manage`
  // не получал доступ к Appointments автоматически.
  const viewAppointments = permissionGate(services, 'appointments.view')
  const manageAppointments = permissionGate(services, 'appointments.manage')

  const viewPromotions = permissionGate(promotions, 'promos.view')
  const managePromotions = permissionGate(promotions, 'promos.manage')

  // Контент/настройки/команда/биллинг — без модуля (есть всегда).
  const alwaysOn = computed<GateResult>(() => isSuspended.value ? deny('suspended') : ok())
  const teamSection = permissionGate(team, 'team.manage')
  // Филиалы — только пермишен, без plan-фичи: даже на базовом тарифе доступна страница «Заведение».
  // Если юзер на онбординге явно отказался от филиала — раздел скрываем (через флаг branchesNotNeeded).
  const branchesAvailable = computed<GateResult>(() => branchesNotNeeded.value ? deny('opted-out') : alwaysOn.value)
  const viewBranches = permissionGate(branchesAvailable, 'team.manage')
  const manageRoles = permissionGate(team, 'roles.manage')
  const viewContent = permissionGate(alwaysOn, 'content.view')
  const editContent = permissionGate(alwaysOn, 'content.edit')
  const viewSettings = permissionGate(alwaysOn, 'settings.view')
  const editSettings = permissionGate(alwaysOn, 'settings.edit')
  const viewAuditLog = permissionGate(auditLog, 'audit_log.view')
  const viewAnalytics = permissionGate(alwaysOn, 'analytics.view')
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
    viewKitchen, viewKitchenQueue, viewKitchenOverview,
    viewTables, manageTables,
    viewReservations, manageReservations,
    viewAppointments, manageAppointments,
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
