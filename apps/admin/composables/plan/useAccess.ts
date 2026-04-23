import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useResolvedFeatures } from './useResolvedFeatures'
import { useModules } from './useModules'

export const useAccess = () => {
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()
  const { resolved } = useResolvedFeatures()
  const modules = useModules()

  const isServices = computed(() => tenantStore.tenant?.businessType === 'services')

  // Module availability (plan lock + toggle + business type — всё в useModules)
  const delivery = computed(() => modules.delivery?.value?.enabled ?? false)
  const pickup = computed(() => modules.pickup?.value?.enabled ?? false)
  const kitchen = computed(() => modules.kitchen?.value?.enabled ?? false)
  const promotions = computed(() => modules.promotions?.value?.enabled ?? false)
  const dineIn = computed(() => modules.dineIn?.value?.enabled ?? false)
  const combos = computed(() => modules.combos?.value?.enabled ?? false)
  const modifiers = computed(() => modules.modifiers?.value?.enabled ?? false)
  const addons = computed(() => modules.addons?.value?.enabled ?? false)
  const services = computed(() => modules.services?.value?.enabled ?? false)
  const reservations = computed(() => modules.reservations?.value?.enabled ?? false)
  const branches = computed(() => modules.branches?.value?.enabled ?? false)
  const customers = computed(() => modules.customers?.value?.enabled ?? false)
  const customRoles = computed(() => modules.customRoles?.value?.enabled ?? false)
  // team и dashboard — plan-only фичи, не в TenantModules jsonb
  const team = computed(() => resolved.value.modules.team)
  const dashboard = computed(() => resolved.value.modules.dashboard)

  const orders = computed(() => delivery.value || pickup.value || isServices.value)

  // Plan sub-features (accumulated from all eligible plans).
  // ingredients — поле «состав» в карточке блюда и DishPickerModal. Только для общепита (menuStyle='food'),
  // в каталоге товары не раскладываются на ингредиенты.
  const virtualCategories = computed(() => resolved.value.menu.virtualCategories)
  const ingredients = computed(() => resolved.value.menu.ingredients && tenantStore.tenant?.menuStyle === 'food')
  const telegramNotifications = computed(() => resolved.value.site.telegramNotifications)

  // Branches: модуль разблокирован → безлимит (0), иначе — 1 (только главный филиал).
  // Работает одинаково для retail и services — "branches" всегда означает филиалы, не ресурсы.
  const branchesMax = computed(() => resolved.value.modules.branches ? 0 : 1)
  const canAddBranch = computed(() => branchesMax.value === 0 || branchStore.branches.length < branchesMax.value)

  // Resources: для services — лимит бронируемых ресурсов (специалисты/кабинеты/инвентарь).
  // 0 = безлимит. Для retail не используется.
  const resourcesMax = computed(() => resolved.value.resources.max)

  return {
    isServices,
    dashboard,
    delivery, pickup, kitchen, promotions, dineIn, combos,
    modifiers, addons, services, reservations, branches,
    customers, customRoles, team,
    orders,
    virtualCategories, ingredients, telegramNotifications,
    resourcesMax, branchesMax, canAddBranch,
  }
}
