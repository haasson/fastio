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
    reservations: false, services: false, branches: false,
    customRoles: false, customers: false, team: false,
  },
  menu: { virtualCategories: false, ingredients: false },
  resources: { max: 0 },
  site: { telegramNotifications: false },
})

type Subscription = { status: string; plan: string }
type OnboardingState = { branchNotNeeded?: boolean }

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
  { key: 'reservations', name: 'Бронирования', description: '', icon: 'calendar', requiredPlan: 'pro', sortOrder: 6, businessTypes: ['retail'], menuStyles: null },
  { key: 'services', name: 'Услуги', description: '', icon: 'layoutGrid', requiredPlan: 'start', sortOrder: 7, businessTypes: ['services'], menuStyles: null },
  { key: 'promotions', name: 'Акции', description: '', icon: 'promotions', requiredPlan: 'start', sortOrder: 8, businessTypes: ['retail'], menuStyles: null },
  { key: 'combos', name: 'Комбо', description: '', icon: 'puzzle', requiredPlan: 'pro', sortOrder: 9, businessTypes: ['retail'], menuStyles: null },
  { key: 'modifiers', name: 'Модификаторы', description: '', icon: 'palette', requiredPlan: 'start', sortOrder: 11, businessTypes: ['retail'], menuStyles: null },
  { key: 'addons', name: 'Аддоны', description: '', icon: 'plus', requiredPlan: 'start', sortOrder: 12, businessTypes: ['retail'], menuStyles: null },
  { key: 'customers', name: 'Клиенты', description: '', icon: 'users', requiredPlan: 'start', sortOrder: 13, businessTypes: ['retail', 'services'], menuStyles: null },
  { key: 'branches', name: 'Филиалы', description: '', icon: 'mapPin', requiredPlan: 'pro', sortOrder: 14, businessTypes: ['retail', 'services'], menuStyles: null },
  { key: 'customRoles', name: 'Кастомные роли', description: '', icon: 'users', requiredPlan: 'pro', sortOrder: 15, businessTypes: ['retail', 'services'], menuStyles: null },
])

vi.mock('~/stores/tenant', () => ({ useTenantStore: () => tenantStore }))
vi.mock('~/stores/branch', () => ({ useBranchStore: () => branchStore }))
vi.mock('../plan/useResolvedFeatures', () => ({ useResolvedFeatures: () => ({ resolved }) }))
vi.mock('../plan/useModules', () => ({
  useModules: () => new Proxy({}, {
    get: (_, key: string) => computed(() => moduleStates.value[key] ?? { active: false, locked: false, absent: false, enabled: false },
    ),
  }),
  useModuleConfigs: () => ({ configs: moduleConfigs, loaded: ref(true), load: async () => {} }),
}))

vi.mock('~/utils/featureFlags', () => ({ AUDIT_LOG_ENABLED: false }))

// Импорт после моков!
const importGate = async () => (await import('../plan/useGate')).useGate

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
      reservations: false, services: false, branches: false,
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

  describe('branchNotNeeded (опт-аут на онбординге)', () => {
    it('branches opted-out если юзер выбрал «не указывать филиал»', async () => {
      const useGate = await importGate()

      allEnabled('branches')
      tenantStore.maybeTenant.onboardingState = { branchNotNeeded: true }

      const gate = useGate()

      expect(gate.branches.value.enabled).toBe(false)
      expect(gate.branches.value.reason).toBe('opted-out')
    })

    it('viewBranches opted-out если branchNotNeeded даже когда есть team.manage', async () => {
      const useGate = await importGate()

      tenantStore.maybeTenant.onboardingState = { branchNotNeeded: true }
      tenantStore.currentPermissions = { 'team.manage': true }

      const gate = useGate()

      expect(gate.viewBranches.value.enabled).toBe(false)
      expect(gate.viewBranches.value.reason).toBe('opted-out')
    })

    it('viewBranches enabled когда branchNotNeeded не выставлен', async () => {
      const useGate = await importGate()

      tenantStore.currentPermissions = { 'team.manage': true }

      const gate = useGate()

      expect(gate.viewBranches.value.enabled).toBe(true)
    })

    it('addBranch разрешает первый филиал даже при branchNotNeeded — для override через поддержку', async () => {
      const useGate = await importGate()

      tenantStore.maybeTenant.onboardingState = { branchNotNeeded: true }
      setModule('branches', { active: false, locked: true })
      branchStore.branches = []

      const gate = useGate()

      // branches возвращает opted-out → addBranch проверяет «филиалов 0?». Если да — разрешает
      // создать главный филиал (для случая, когда поддержка вручную сбросит флаг).
      expect(gate.addBranch.value.enabled).toBe(true)
    })
  })

  describe('reservations / services вилка', () => {
    it('viewReservations для retail использует модуль reservations', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'retail'
      allEnabled('reservations')
      tenantStore.currentPermissions = { 'reservations.view': true }

      const gate = useGate()

      expect(gate.viewReservations.value.enabled).toBe(true)
    })

    it('viewReservations для services использует модуль services', async () => {
      const useGate = await importGate()

      tenantStore.tenant.businessType = 'services'
      allEnabled('services')
      tenantStore.currentPermissions = { 'reservations.view': true }

      const gate = useGate()

      expect(gate.viewReservations.value.enabled).toBe(true)
    })
  })
})
