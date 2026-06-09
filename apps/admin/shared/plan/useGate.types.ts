/**
 * Единая модель причин, по которым фича может быть недоступна.
 * Приоритет (от высшего к низшему):
 *   suspended → absent → flag → locked → opted-out → disabled → unconfigured → forbidden → null
 *
 * Высший приоритет — самый "глобальный" отказ. Если аккаунт suspended, нет
 * смысла говорить пользователю "нужен план повыше" или "нет прав".
 */
export type GateReason
  = | 'suspended' // подписка приостановлена (доступ только в /account/*)
    | 'absent' // тип бизнеса/menuStyle не поддерживает фичу
    | 'flag' // compile-time feature flag выключен
    | 'locked' // тариф ниже требуемого
    | 'opted-out' // юзер явно отказался от фичи на онбординге (для возврата нужна поддержка)
    | 'disabled' // модуль выключен пользователем в /settings/modules
    | 'unconfigured' // нужна настройка тенанта (например scheduledOrders.enabled=false)
    | 'forbidden' // нет прав по роли
    | null // фича доступна

export type GateResult = {
  /** true если reason === null. Для удобства в шаблонах: `v-if="gate.X.value.enabled"`. */
  enabled: boolean
  reason: GateReason
  /** Для reason === 'locked': ключ требуемого тарифа (например 'pro'). */
  requiredPlan?: string
  /** Для reason === 'unconfigured': роут для перехода к настройке. */
  configPath?: string
  /** Для reason === 'unconfigured': короткое объяснение что именно настроить. */
  hint?: string
}

/** Реестр известных гейтов. Ключ → ComputedRef<GateResult>. */
export type GateRegistry = Record<GateKey, import('vue').ComputedRef<GateResult>>

/**
 * Все ключи, которые можно проверить через useGate().
 *
 * - **feature-only** гейты — отвечают только на "доступна ли фича тенанту"
 *   (без role-check). Используются для условного UI внутри уже доступных
 *   страниц (например, показывать ли тип доставки в карточке заказа).
 *
 * - **permission-aware** гейты (`viewX` / `manageX`) — учитывают роль пользователя.
 *   Используются для навигации и скрытия целых разделов.
 */
export type GateKey
  // ───── Feature-only (без role-check) ─────
  // module-based (соответствуют TenantModules + plan-only)
  = | 'orders' | 'delivery' | 'pickup' | 'dineIn'
    | 'kitchen' | 'reservations' | 'services'
    | 'promotions' | 'modifiers' | 'addons' | 'combos' | 'customers'
    | 'menu' | 'team' | 'dashboard'
    | 'branches' | 'customRoles'
  // plan sub-features (только тариф)
    | 'virtualCategories' | 'ingredients' | 'telegramNotifications'
  // compile-time flags
    | 'auditLog'
  // tenant-config-driven
    | 'scheduledOrders' | 'kitchenAutoStatus'
  // ───── Permission-aware (с role-check) ─────
    | 'viewMenu' | 'manageMenu'
    | 'viewServiceMenu' | 'manageServiceMenu'
    | 'viewOrders'
    | 'viewKitchen' | 'viewKitchenQueue' | 'viewKitchenOverview' | 'cookKitchen'
    | 'viewTables' | 'manageTables' | 'viewTableHistory'
    | 'viewReservations' | 'manageReservations'
    | 'viewAppointments' | 'manageAppointments' | 'viewAllAppointments'
    | 'viewPromotions' | 'managePromotions'
    | 'viewContent' | 'editContent'
    | 'viewTeam' | 'manageTeam' | 'manageRoles'
    | 'viewBranches'
    | 'viewSettings' | 'editSettings'
    | 'viewAuditLog'
    | 'viewAnalytics'
    | 'manageBilling'
  // ───── Special ─────
    | 'addBranch'
