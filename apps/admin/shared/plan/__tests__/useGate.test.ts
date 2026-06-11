import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import type { RolePermissions, ResolvedFeatures, BusinessType, MenuStyle } from '@fastio/shared'
import type { ModuleConfig } from '~/config/modules'

// ──────────────────────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────────────────────

type ModuleState = { active: boolean; locked: boolean; absent: boolean; enabled: boolean }
type ModuleStateMap = Record<string, ModuleState>

const moduleStates = ref<ModuleStateMap>({})
const setModule = (key: string, state: Partial<ModuleState>) => {
  const prev = moduleStates.value[key] ?? { active: false, locked: false, absent: false, enabled: false }
  const next = { ...prev, ...state }

  next.enabled = next.active && !next.locked && !next.absent
  moduleStates.value = { ...moduleStates.value, [key]: next }
}
const allEnabled = (...keys: string[]) => keys.forEach((k) => setModule(k, { active: true, locked: false, absent: false }))

const resolved = ref<ResolvedFeatures>({
  modules: {
    dashboard: false, delivery: false, pickup: false, modifiers: false, addons: false,
    promotions: false, combos: false, kitchen: false, dineIn: false,
    services: false, branches: false,
    customRoles: false, customers: false, team: false,
  },
  menu: { virtualCategories: false, ingredients: false },
  resources: { max: 0 },
  site: { telegramNotifications: false },
})

type Subscription = { status: string; plan: string }
type OnboardingState = Record<string, never>

const tenantStore = {
  isOwner: false,
  currentPermissions: null as RolePermissions | null,
  maybeTenant: { subscription: { status: 'active' } as Subscription, onboardingState: undefined as OnboardingState | undefined },
  get isServices() { return this.tenant.businessType === 'services' },
  get isRetail() { return this.tenant.businessType === 'retail' },
  tenant: {
    businessType: 'retail' as BusinessType,
    menuStyle: 'food' as MenuStyle,
    modules: {} as Record<string, boolean>,
    orderSchedulingConfig: { enabled: false } as { enabled: boolean },
    kitchenConfig: { sourceStatusId: null as string | null },
  },
}

const branchStore = { branches: [] as { id: string }[] }

const moduleConfigs = ref<ModuleConfig[]>([
  { key: 'kitchen', name: 'Кухня', description: '', icon: 'chefHat', requiredPlan: 'pro', sortOrder: 10, businessTypes: ['retail'], menuStyles: null },
  { key: 'delivery', name: 'Доставка', description: '', icon: 'bike', requiredPlan: 'start', sortOrder: 1, businessTypes: ['retail'], menuStyles: null },
  { key: 'pickup', name: 'Самовывоз', description: '', icon: 'orders', requiredPlan: 'start', sortOrder: 2, businessTypes: ['retail'], menuStyles: null },
  { key: 'dineIn', name: 'Столы', description: '', icon: 'tableIcon', requiredPlan: 'pro', sortOrder: 5, businessTypes: ['retail'], menuStyles: null },
  { key: 'services', name: 'Услуги', description: '', icon: 'layoutGrid', requiredPlan: 'start', sortOrder: 7, businessTypes: ['services'], menuStyles: null },
  { key: 'promotions', name: 'Акции', description: '', icon: 'promotions', requiredPlan: 'start', sortOrder: 8, businessTypes: ['retail'], menuStyles: null },
  { key: 'combos', name: 'Комбо', description: '', icon: 'puzzle', requiredPlan: 'pro', sortOrder: 9, businessTypes: ['retail'], menuStyles: null },
  { key: 'modifiers', name: 'Модификаторы', description: '', icon: 'palette', requiredPlan: 'start', sortOrder: 11, businessTypes: ['retail'], menuStyles: null },
  { key: 'addons', name: 'Аддоны', description: '', icon: 'plus', requiredPlan: 'start', sortOrder: 12, businessTypes: ['retail'], menuStyles: null },
  { key: 'customers', name: 'Клиенты', description: '', icon: 'users', requiredPlan: 'start', sortOrder: 13, businessTypes: ['retail', 'services'], menuStyles: null },
  { key: 'branches', name: 'Филиалы', description: '', icon: 'mapPin', requiredPlan: 'pro', sortOrder: 14, businessTypes: ['retail', 'services'], menuStyles: null },
  { key: 'customRoles', name: 'Кастомные роли', description: '', icon: 'users', requiredPlan: 'pro', sortOrder: 15, businessTypes: ['retail', 'services'], menuStyles: null },
])

vi.mock('~/shared/stores/tenant', () => ({ useTenantStore: () => tenantStore }))
vi.mock('~/shared/stores/branch', () => ({ useBranchStore: () => branchStore }))
vi.mock('../useResolvedFeatures', () => ({ useResolvedFeatures: () => ({ resolved }) }))
vi.mock('../useModules', () => ({
  useModules: () => new Proxy({}, {
    get: (_, key: string) => computed(() => moduleStates.value[key] ?? { active: false, locked: false, absent: false, enabled: false },
    ),
  }),
  useModuleConfigs: () => ({ configs: moduleConfigs, loaded: ref(true), load: async () => {} }),
}))

vi.mock('~/shared/utils/featureFlags', () => ({ isAuditLogEnabled: () => false }))

// Импорт после моков!
const importGate = async () => (await import('../useGate')).useGate

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const reset = () => {
  tenantStore.isOwner = false
  tenantStore.currentPermissions = null
  tenantStore.maybeTenant = { subscription: { status: 'active', plan: 'pro' }, onboardingState: undefined }
  tenantStore.tenant.businessType = 'retail'
  tenantStore.tenant.menuStyle = 'food'
  tenantStore.tenant.modules = {}
  tenantStore.tenant.orderSchedulingConfig = { enabled: false }
  tenantStore.tenant.kitchenConfig = { sourceStatusId: null }
  branchStore.branches = []
  moduleStates.value = {}
  resolved.value = {
    modules: {
      dashboard: false, delivery: false, pickup: false, modifiers: false, addons: false,
      promotions: false, combos: false, kitchen: false, dineIn: false,
      services: false, branches: false,
      customRoles: false, customers: false, team: false,
    },
    menu: { virtualCategories: false, ingredients: false },
    resources: { max: 0 },
    site: { telegramNotifications: false },
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe('useGate', () => {
  beforeEach(reset)

  describe('приоритет причин', () => {
    it('suspended бьёт всё (даже forbidden и locked)', async () => {
      const useGate = await importGate()

      tenantStore.maybeTenant.subscription.status = 'suspended'
      // Включаем модуль и ставим owner — всё равно suspended
      setModule('kitchen', { active: true })
      tenantStore.isOwner = true

      const gate = useGate()

      expect(gate.kitchen.value).toEqual({ enabled: false, reason: 'suspended' })
      expect(gate.viewKitchen.value.reason).toBe('suspended')
      expect(gate.scheduledOrders.value.reason).toBe('suspended')
    })

    it('absent бьёт locked', async () => {
      const useGate = await importGate()

      // Модуль одновременно absent и locked → возвращаем absent
      setModule('kitchen', { active: false, locked: true, absent: true })

      const gate = useGate()

      expect(gate.kitchen.value.reason).toBe('absent')
    })

    it('locked бьёт disabled', async () => {
      const useGate = await importGate()

      setModule('kitchen', { active: false, locked: true, absent: false })

      const gate = useGate()

      expect(gate.kitchen.value.reason).toBe('locked')
      expect(gate.kitchen.value.requiredPlan).toBe('pro')
    })

    it('disabled когда модуль не active, но не locked/absent', async () => {
      const useGate = await importGate()

      setModule('kitchen', { active: false, locked: false, absent: false })

      const gate = useGate()

      expect(gate.kitchen.value.reason).toBe('disabled')
    })

    it('forbidden только когда фича доступна, но нет права', async () => {
      const useGate = await importGate()

      allEnabled('kitchen')
      tenantStore.currentPermissions = {} // нет kitchen.view

      const gate = useGate()

      expect(gate.kitchen.value.enabled).toBe(true)
      expect(gate.viewKitchen.value.reason).toBe('forbidden')
    })

    it('feature причина важнее forbidden (locked модуль не показывает forbidden)', async () => {
      const useGate = await importGate()

      setModule('kitchen', { active: true, locked: true, absent: false })
      tenantStore.currentPermissions = {} // нет прав

      const gate = useGate()

      // Тенанту фича недоступна — не показываем "нет прав", показываем locked
      expect(gate.viewKitchen.value.reason).toBe('locked')
    })

    it('null reason когда всё включено', async () => {
      const useGate = await importGate()

      allEnabled('kitchen')
      tenantStore.currentPermissions = { 'kitchen.view': true }

      const gate = useGate()

      expect(gate.kitchen.value).toEqual({ enabled: true, reason: null })
      expect(gate.viewKitchen.value).toEqual({ enabled: true, reason: null })
    })
  })

  describe('owner', () => {
    it('owner проходит любые role-checks', async () => {
      const useGate = await importGate()

      allEnabled('kitchen', 'delivery', 'promotions')
      tenantStore.isOwner = true
      tenantStore.currentPermissions = null

      const gate = useGate()

      expect(gate.viewKitchen.value.enabled).toBe(true)
      expect(gate.manageBilling.value.enabled).toBe(true)
      expect(gate.viewAnalytics.value.enabled).toBe(true)
    })

    it('owner НЕ обходит suspended', async () => {
      const useGate = await importGate()

      tenantStore.isOwner = true
      tenantStore.maybeTenant.subscription.status = 'suspended'
      allEnabled('kitchen')

      const gate = useGate()

      expect(gate.viewKitchen.value.reason).toBe('suspended')
    })

    it('owner НЕ обходит locked (тариф — это про подписку, не про роль)', async () => {
      const useGate = await importGate()

      setModule('kitchen', { active: false, locked: true })
      tenantStore.isOwner = true

      const gate = useGate()

      expect(gate.viewKitchen.value.reason).toBe('locked')
    })
  })

  describe('config-driven gates', () => {
    it('scheduledOrders unconfigured когда orders доступен, но enabled=false', async () => {
      const useGate = await importGate()

      allEnabled('delivery', 'pickup')
      tenantStore.tenant.orderSchedulingConfig = { enabled: false }

      const gate = useGate()

      expect(gate.scheduledOrders.value.reason).toBe('unconfigured')
      expect(gate.scheduledOrders.value.configPath).toBe('/orders/settings')
      expect(gate.scheduledOrders.value.hint).toBeTruthy()
    })

    it('scheduledOrders enabled когда настройка включена', async () => {
      const useGate = await importGate()

      allEnabled('delivery')
      tenantStore.tenant.orderSchedulingConfig = { enabled: true }

      const gate = useGate()

      expect(gate.scheduledOrders.value.enabled).toBe(true)
    })

    it('scheduledOrders наследует locked если orders заблокирован', async () => {
      const useGate = await importGate()

      setModule('delivery', { active: false, locked: true })
      setModule('pickup', { active: false, locked: true })
      tenantStore.tenant.orderSchedulingConfig = { enabled: true }

      const gate = useGate()

      expect(gate.scheduledOrders.value.reason).toBe('locked')
    })

    it('kitchenAutoStatus unconfigured когда kitchen enabled, но sourceStatusId=null', async () => {
      const useGate = await importGate()

      allEnabled('kitchen')
      tenantStore.tenant.kitchenConfig = { sourceStatusId: null }

      const gate = useGate()

      expect(gate.kitchenAutoStatus.value.reason).toBe('unconfigured')
      expect(gate.kitchenAutoStatus.value.configPath).toBe('/kitchen/settings')
    })

    it('kitchenAutoStatus ok когда sourceStatusId задан', async () => {
      const useGate = await importGate()

      allEnabled('kitchen')
      tenantStore.tenant.kitchenConfig = { sourceStatusId: 'st-1' }

      const gate = useGate()

      expect(gate.kitchenAutoStatus.value.enabled).toBe(true)
    })
  })

  describe('compile-time flags', () => {
    it('auditLog flag-disabled', async () => {
      const useGate = await importGate()

      const gate = useGate()

      expect(gate.auditLog.value.reason).toBe('flag')
      // Permission-aware viewAuditLog тоже flag (приоритет фичи выше permission)
      tenantStore.currentPermissions = { 'audit_log.view': true }
      expect(gate.viewAuditLog.value.reason).toBe('flag')
    })
  })

  describe('orders aggregate', () => {
    it('orders enabled если хотя бы один из delivery/pickup доступен', async () => {
      const useGate = await importGate()

      allEnabled('delivery')
      const gate = useGate()

      expect(gate.orders.value.enabled).toBe(true)
    })

    it('orders для services всегда disabled (заказы — это retail-фича)', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      allEnabled('services')

      const gate = useGate()

      expect(gate.orders.value.enabled).toBe(false)
      expect(gate.orders.value.reason).toBe('disabled')
    })

    it('orders disabled показывает disabled если хотя бы один disabled (приоритет над locked)', async () => {
      const useGate = await importGate()

      setModule('delivery', { active: false, locked: false }) // disabled
      setModule('pickup', { active: false, locked: true }) // locked

      const gate = useGate()

      expect(gate.orders.value.reason).toBe('disabled')
    })
  })

  describe('plan-only features', () => {
    it('virtualCategories locked когда не в resolved', async () => {
      const useGate = await importGate()

      const gate = useGate()

      expect(gate.virtualCategories.value.reason).toBe('locked')
    })

    it('virtualCategories enabled когда resolved.menu.virtualCategories=true', async () => {
      const useGate = await importGate()

      resolved.value.menu.virtualCategories = true

      const gate = useGate()

      expect(gate.virtualCategories.value.enabled).toBe(true)
    })

    it('ingredients требует menuStyle=food', async () => {
      const useGate = await importGate()

      resolved.value.menu.ingredients = true
      tenantStore.tenant.menuStyle = 'catalog'

      const gate = useGate()

      expect(gate.ingredients.value.enabled).toBe(false)

      tenantStore.tenant.menuStyle = 'food'
      const gate2 = useGate()

      expect(gate2.ingredients.value.enabled).toBe(true)
    })
  })

  describe('dashboard — требует analytics.view (регрессия)', () => {
    // Дашборд гейтит и nav-видимость, и ROOT_GATE роута `/`. Роль без analytics.view
    // («Сотрудник») не должна видеть дашборд — middleware уводит её на /orders. Спека 2.13.
    it('роль без analytics.view → dashboard forbidden (при включённом модуле)', async () => {
      const useGate = await importGate()

      resolved.value.modules.dashboard = true
      tenantStore.currentPermissions = { 'orders.view': true } as RolePermissions

      const gate = useGate()

      expect(gate.dashboard.value.enabled).toBe(false)
      expect(gate.dashboard.value.reason).toBe('forbidden')
    })

    it('роль с analytics.view → dashboard enabled', async () => {
      const useGate = await importGate()

      resolved.value.modules.dashboard = true
      tenantStore.currentPermissions = { 'analytics.view': true } as RolePermissions

      const gate = useGate()

      expect(gate.dashboard.value).toEqual({ enabled: true, reason: null })
    })

    it('модуль dashboard выключен → недоступен даже с analytics.view', async () => {
      const useGate = await importGate()

      resolved.value.modules.dashboard = false
      tenantStore.currentPermissions = { 'analytics.view': true } as RolePermissions

      const gate = useGate()

      expect(gate.dashboard.value.enabled).toBe(false)
    })
  })

  describe('addBranch limit', () => {
    it('addBranch ok если модуль branches enabled', async () => {
      const useGate = await importGate()

      allEnabled('branches')

      const gate = useGate()

      expect(gate.addBranch.value.enabled).toBe(true)
    })

    it('addBranch ok если модуль выключен, но филиалов 0 (главный ещё не создан)', async () => {
      const useGate = await importGate()

      setModule('branches', { active: false, locked: true })
      branchStore.branches = []

      const gate = useGate()

      expect(gate.addBranch.value.enabled).toBe(true)
    })

    it('addBranch заблокирован если модуль выключен и филиал уже есть', async () => {
      const useGate = await importGate()

      setModule('branches', { active: false, locked: true })
      branchStore.branches = [{ id: 'b1' }]

      const gate = useGate()

      expect(gate.addBranch.value.enabled).toBe(false)
      expect(gate.addBranch.value.reason).toBe('locked')
    })
  })

  describe('viewBranches — без opt-out, гейт только пермишеном', () => {
    it('viewBranches enabled с team.manage', async () => {
      const useGate = await importGate()

      tenantStore.currentPermissions = { 'team.manage': true }

      const gate = useGate()

      expect(gate.viewBranches.value.enabled).toBe(true)
    })

    it('viewBranches forbidden без team.manage', async () => {
      const useGate = await importGate()

      tenantStore.currentPermissions = {}

      const gate = useGate()

      expect(gate.viewBranches.value.enabled).toBe(false)
      expect(gate.viewBranches.value.reason).toBe('forbidden')
    })
  })

  describe('menu vs serviceMenu — раздельные гейты по businessType', () => {
    it('viewMenu для food-тенанта enabled с правом', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'retail'
      tenantStore.currentPermissions = { 'menu.view': true }

      const gate = useGate()

      expect(gate.viewMenu.value.enabled).toBe(true)
    })

    it('viewMenu для services-тенанта absent (не должен открывать /menu)', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      tenantStore.currentPermissions = { 'menu.view': true }

      const gate = useGate()

      expect(gate.viewMenu.value.enabled).toBe(false)
      expect(gate.viewMenu.value.reason).toBe('absent')
    })

    it('viewServiceMenu для services-тенанта enabled когда services модуль включён', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      allEnabled('services')
      tenantStore.currentPermissions = { 'menu.view': true }

      const gate = useGate()

      expect(gate.viewServiceMenu.value.enabled).toBe(true)
    })

    it('viewServiceMenu для food-тенанта absent', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'retail'
      tenantStore.currentPermissions = { 'menu.view': true }

      const gate = useGate()

      expect(gate.viewServiceMenu.value.enabled).toBe(false)
      expect(gate.viewServiceMenu.value.reason).toBe('absent')
    })

    it('manageServiceMenu требует menu.edit + services-тенант + services модуль', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      allEnabled('services')
      tenantStore.currentPermissions = { 'menu.edit': true }

      const gate = useGate()

      expect(gate.manageServiceMenu.value.enabled).toBe(true)
    })
  })

  describe('reservations vs appointments — отдельные ключи', () => {
    it('viewReservations для retail бэкуется модулем dineIn + tables.view', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'retail'
      allEnabled('dineIn') // брони теперь часть модуля «Столы»
      tenantStore.currentPermissions = { 'tables.view': true }

      const gate = useGate()

      expect(gate.viewReservations.value.enabled).toBe(true)
      // appointments.* отдельный ключ — без него гейт не открыт.
      expect(gate.viewAppointments.value.enabled).toBe(false)
    })

    it('viewAppointments для services требует appointments.view, не tables.view', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      allEnabled('services')
      tenantStore.currentPermissions = { 'tables.view': true }

      const gate = useGate()

      // tables.view (брони) сам по себе не открывает Appointments.
      expect(gate.viewAppointments.value.enabled).toBe(false)

      tenantStore.currentPermissions = { 'appointments.view': true }
      const gate2 = useGate()

      expect(gate2.viewAppointments.value.enabled).toBe(true)
    })

    it('manageAppointments требует appointments.manage', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      allEnabled('services')
      tenantStore.currentPermissions = { 'appointments.manage': true }

      const gate = useGate()

      expect(gate.manageAppointments.value.enabled).toBe(true)
    })
  })

  // ───── 1.6 расширения ─────

  describe('manageAppointments × роли × состояния модуля', () => {
    // Перебираем сценарии: модуль services активен / не активен × роль (owner/admin/manager/staff)
    // Цель: убедиться что гейт корректно реагирует и на доступность фичи, и на permissions.

    it('owner + services enabled → enabled (owner обходит permissions)', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      allEnabled('services')
      tenantStore.isOwner = true
      tenantStore.currentPermissions = null

      const gate = useGate()

      expect(gate.manageAppointments.value.enabled).toBe(true)
    })

    it('owner + services locked → locked (owner не обходит plan-lock)', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      setModule('services', { active: false, locked: true })
      tenantStore.isOwner = true

      const gate = useGate()

      expect(gate.manageAppointments.value.enabled).toBe(false)
      expect(gate.manageAppointments.value.reason).toBe('locked')
    })

    it('admin (с appointments.manage) + services enabled → enabled', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      allEnabled('services')
      tenantStore.currentPermissions = { 'appointments.manage': true }

      const gate = useGate()

      expect(gate.manageAppointments.value.enabled).toBe(true)
    })

    it('manager (только tables.manage, без appointments.*) → forbidden', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      allEnabled('services')
      tenantStore.currentPermissions = { 'tables.manage': true }

      const gate = useGate()

      expect(gate.manageAppointments.value.enabled).toBe(false)
      expect(gate.manageAppointments.value.reason).toBe('forbidden')
    })

    it('staff (только appointments.view) → forbidden на manage', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      allEnabled('services')
      tenantStore.currentPermissions = { 'appointments.view': true }

      const gate = useGate()

      expect(gate.manageAppointments.value.enabled).toBe(false)
      expect(gate.manageAppointments.value.reason).toBe('forbidden')
      // …при этом view доступен
      expect(gate.viewAppointments.value.enabled).toBe(true)
    })

    it('admin + services disabled (модуль выключен на тарифе) → reason=disabled, не forbidden', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      setModule('services', { active: false, locked: false, absent: false })
      tenantStore.currentPermissions = { 'appointments.manage': true }

      const gate = useGate()

      expect(gate.manageAppointments.value.reason).toBe('disabled')
    })

    it('admin + services absent → reason=absent', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      setModule('services', { active: false, locked: false, absent: true })
      tenantStore.currentPermissions = { 'appointments.manage': true }

      const gate = useGate()

      expect(gate.manageAppointments.value.reason).toBe('absent')
    })
  })

  describe('viewAppointments на retail-тенанте', () => {
    it('disabled — модуль services отсутствует у retail', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'retail'
      // services даже не активирован на retail-плане
      setModule('services', { active: false, locked: false, absent: true })
      tenantStore.currentPermissions = { 'appointments.view': true }

      const gate = useGate()

      expect(gate.viewAppointments.value.enabled).toBe(false)
      expect(gate.viewAppointments.value.reason).toBe('absent')
    })

    it('даже у owner на retail без модуля services — disabled', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'retail'
      setModule('services', { active: false })
      tenantStore.isOwner = true

      const gate = useGate()

      expect(gate.viewAppointments.value.enabled).toBe(false)
    })
  })

  describe('menu deny для services-тенанта', () => {
    // services-tenant не должен видеть «обычные» menu-страницы — только serviceMenu.
    it('viewMenu = absent для services даже с menu.view', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      tenantStore.currentPermissions = { 'menu.view': true }

      const gate = useGate()

      expect(gate.viewMenu.value.enabled).toBe(false)
      expect(gate.viewMenu.value.reason).toBe('absent')
    })

    it('manageMenu = absent для services даже с menu.edit', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      tenantStore.currentPermissions = { 'menu.edit': true }

      const gate = useGate()

      expect(gate.manageMenu.value.enabled).toBe(false)
      expect(gate.manageMenu.value.reason).toBe('absent')
    })

    it('owner на services-тенанте всё равно не видит viewMenu (это absent, не permission)', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      tenantStore.isOwner = true

      const gate = useGate()

      expect(gate.viewMenu.value.enabled).toBe(false)
      expect(gate.viewMenu.value.reason).toBe('absent')
    })
  })

  describe('suspended consistency — все гейты должны быть false', () => {
    // Регрессия: suspended-тенант не должен иметь ни одного активного гейта.
    // Если новый гейт в useGate забыл проверять suspended — падает здесь.

    const ALL_GATES: Array<{
      key: string
      // Какие условия сделать «зелёными» в обычном случае: тенант+модули+permissions.
      setup?: (s: typeof tenantStore) => void
    }> = [
      { key: 'kitchen', setup: () => allEnabled('kitchen') },
      { key: 'orders', setup: () => allEnabled('delivery', 'pickup') },
      { key: 'dineIn', setup: () => allEnabled('dineIn') },
      { key: 'reservations', setup: () => allEnabled('dineIn') }, // === dineIn
      { key: 'services', setup: () => allEnabled('services') },
      { key: 'promotions', setup: () => allEnabled('promotions') },
      { key: 'modifiers', setup: () => allEnabled('modifiers') },
      { key: 'addons', setup: () => allEnabled('addons') },
      { key: 'combos', setup: () => allEnabled('combos') },
      { key: 'branches', setup: () => allEnabled('branches') },
      { key: 'customers', setup: () => allEnabled('customers') },
      { key: 'customRoles', setup: () => allEnabled('customRoles') },
      { key: 'viewMenu' },
      { key: 'manageMenu' },
      { key: 'viewKitchen', setup: () => allEnabled('kitchen') },
      { key: 'viewOrders', setup: () => allEnabled('delivery') },
      { key: 'viewTables', setup: () => allEnabled('dineIn') },
      { key: 'manageTables', setup: () => allEnabled('dineIn') },
      { key: 'viewReservations', setup: () => allEnabled('dineIn') },
      { key: 'manageReservations', setup: () => allEnabled('dineIn') },
      { key: 'viewAppointments', setup: (s) => {
        s.tenant.businessType = 'services'
        allEnabled('services')
      } },
      { key: 'manageAppointments', setup: (s) => {
        s.tenant.businessType = 'services'
        allEnabled('services')
      } },
      { key: 'viewPromotions', setup: () => allEnabled('promotions') },
      { key: 'managePromotions', setup: () => allEnabled('promotions') },
      { key: 'viewBranches' },
      { key: 'manageBilling' },
      { key: 'viewAnalytics' },
      { key: 'viewTeam' },
      { key: 'manageTeam' },
      { key: 'manageRoles' },
      { key: 'viewSettings' },
      { key: 'editSettings' },
      { key: 'viewContent' },
      { key: 'editContent' },
      { key: 'addBranch' },
      { key: 'scheduledOrders', setup: () => {
        allEnabled('delivery')
        tenantStore.tenant.orderSchedulingConfig = { enabled: true }
      } },
      { key: 'kitchenAutoStatus', setup: () => {
        allEnabled('kitchen')
        tenantStore.tenant.kitchenConfig = { sourceStatusId: 's1' }
      } },
    ]

    it.each(ALL_GATES)('гейт $key с suspended → enabled=false', async ({ key, setup }) => {
      const useGate = await importGate()

      // Сначала включаем «зелёный» сценарий, чтобы убедиться что только suspended валит гейт.
      tenantStore.isOwner = true
      tenantStore.currentPermissions = {
        'menu.view': true, 'menu.edit': true,
        'orders.view': true,
        'kitchen.view': true,
        'tables.view': true, 'tables.manage': true,
        'appointments.view': true, 'appointments.manage': true,
        'promos.view': true, 'promos.manage': true,
        'branches.view': true,
        'team.manage': true, 'roles.manage': true,
        'settings.view': true, 'settings.edit': true,
        'content.view': true, 'content.edit': true,
        'analytics.view': true, 'audit_log.view': true, 'billing.manage': true,
      } as RolePermissions
      setup?.(tenantStore)

      // Только потом — suspended.
      tenantStore.maybeTenant.subscription.status = 'suspended'

      const gate = useGate()
      const target = gate[key as keyof typeof gate]

      expect(target.value.enabled).toBe(false)
    })
  })
})
