import { computed, type ComputedRef } from 'vue'
import { ok, deny, useGateInfra } from '~/shared/plan/useGate.shared'
import type { GateResult } from '~/shared/plan/useGate.types'

/**
 * Гейты retail-вертикали (общепит / food).
 *
 * Возвращает только retail-специфичные ключи. Файлам, которым нужны
 * shared-гейты (`viewSettings`, `viewBranches`, `dashboard` и т.п.) — берут
 * их через `useGate()` (агрегатор, в allow-list).
 *
 * Цель split-а: retail-код, импортя `useGateRetail()`, физически не имеет
 * доступа к services-гейтам — типы про них не знают.
 */
export type RetailGateKey
  = | 'orders' | 'delivery' | 'pickup' | 'dineIn'
    | 'kitchen' | 'reservations'
    | 'promotions' | 'modifiers' | 'addons' | 'combos'
    | 'menu'
    | 'virtualCategories' | 'ingredients'
    | 'scheduledOrders' | 'kitchenAutoStatus'
    | 'viewMenu' | 'manageMenu'
    | 'viewOrders'
    | 'viewKitchen' | 'viewKitchenQueue' | 'viewKitchenOverview'
    | 'viewTables' | 'manageTables'
    | 'viewReservations' | 'manageReservations'
    | 'viewPromotions' | 'managePromotions'

export type RetailGateRegistry = Record<RetailGateKey, ComputedRef<GateResult>>

export const useGateRetail = (): RetailGateRegistry => {
  const { tenantStore, resolved, isSuspended, hasPermission, moduleGate, planFeatureGate, permissionGate, configGate } = useGateInfra()

  const delivery = moduleGate('delivery')
  const pickup = moduleGate('pickup')
  const dineIn = moduleGate('dineIn')
  const kitchen = moduleGate('kitchen')
  // reservations — теперь часть модуля «Столы» (dineIn), не отдельный тоггл.
  // Один тоггл включает и зал, и бронирование. viewReservations/manageReservations
  // ниже бэкуются этим же гейтом, но проверяют свой permission.
  const reservations = dineIn
  const promotions = moduleGate('promotions')
  const modifiers = moduleGate('modifiers')
  const addons = moduleGate('addons')
  const combos = moduleGate('combos')

  const menu = computed<GateResult>(() => {
    if (isSuspended.value) return deny('suspended')
    if (tenantStore.isServices) return deny('absent')

    return ok()
  })

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

  const virtualCategories = planFeatureGate(() => resolved.value.menu.virtualCategories)
  const ingredients = planFeatureGate(() => resolved.value.menu.ingredients && tenantStore.tenant.menuStyle === 'food')

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

  const viewMenu = permissionGate(menu, 'menu.view')
  const manageMenu = permissionGate(menu, 'menu.edit')

  const viewOrders = permissionGate(orders, 'orders.view')

  // Кухня требует одно из двух прав (как в текущем AppNav).
  const viewKitchen = computed<GateResult>(() => {
    if (isSuspended.value) return deny('suspended')
    if (!kitchen.value.enabled) return kitchen.value
    if (hasPermission('kitchen.view') || hasPermission('kitchen.overview')) return ok()

    return deny('forbidden')
  })
  const viewKitchenQueue = permissionGate(kitchen, 'kitchen.view')
  const viewKitchenOverview = permissionGate(kitchen, 'kitchen.overview')

  const viewTables = permissionGate(dineIn, 'tables.view')
  const manageTables = permissionGate(dineIn, 'tables.manage')

  // Брони — часть модуля «Столы»: отдельных прав нет, бэкуются tables.view/tables.manage.
  const viewReservations = permissionGate(reservations, 'tables.view')
  const manageReservations = permissionGate(reservations, 'tables.manage')

  const viewPromotions = permissionGate(promotions, 'promos.view')
  const managePromotions = permissionGate(promotions, 'promos.manage')

  return {
    orders, delivery, pickup, dineIn,
    kitchen, reservations,
    promotions, modifiers, addons, combos,
    menu,
    virtualCategories, ingredients,
    scheduledOrders, kitchenAutoStatus,
    viewMenu, manageMenu,
    viewOrders,
    viewKitchen, viewKitchenQueue, viewKitchenOverview,
    viewTables, manageTables,
    viewReservations, manageReservations,
    viewPromotions, managePromotions,
  }
}
