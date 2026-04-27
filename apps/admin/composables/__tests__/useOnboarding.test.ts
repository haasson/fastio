import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { emptyOnboardingState, type Tenant, type OnboardingState, type TenantModules } from '@fastio/shared'

const emptyModules = (): TenantModules => ({
  delivery: false,
  pickup: false,
  modifiers: false,
  addons: false,
  promotions: false,
  combos: false,
  customRoles: false,
  dineIn: false,
  kitchen: false,
  reservations: false,
  customers: false,
  services: false,
  branches: false,
})

const gateDelivery = ref(false)
const gatePickup = ref(false)
const gateDineIn = ref(false)
const gateReservations = ref(false)
const gateServices = ref(false)

const makeGateResult = (enabled: boolean) => ({ enabled, reason: enabled ? null : 'disabled' as const })

vi.mock('~/composables/plan/useGate', () => ({
  useGate: () => ({
    delivery: computed(() => makeGateResult(gateDelivery.value)),
    pickup: computed(() => makeGateResult(gatePickup.value)),
    dineIn: computed(() => makeGateResult(gateDineIn.value)),
    reservations: computed(() => makeGateResult(gateReservations.value)),
    services: computed(() => makeGateResult(gateServices.value)),
  }),
}))

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: 't-1',
  name: 'Test',
  slug: 'test',
  customDomain: null,
  ownerId: 'u-1',
  businessType: null,
  menuStyle: 'food',
  theme: {} as Tenant['theme'],
  siteLayout: {} as Tenant['siteLayout'],
  siteContent: {} as Tenant['siteContent'],
  contacts: {
    phone: '',
    email: '',
    address: '',
    instagram: null,
    vk: null,
    telegram: null,
    whatsapp: null,
    max: null,
    offerUrl: null,
  },
  workingHoursSchedule: null,
  notifications: { email: null, telegramChatId: null },
  balance: 0,
  subscription: {
    status: 'trial',
    plan: 'start',
    trialEndsAt: null,
    renewsAt: null,
    pastDueAt: null,
    priceOverride: null,
    gracePeriodDays: null,
  },
  modules: emptyModules(),
  deliveryMinOrder: 0,
  deliveryFee: 0,
  freeDeliveryFrom: 0,
  deliveryDescription: '',
  deliveryMode: 'zones',
  deliveryAvailable: false,
  orderingEnabled: false,
  currency: 'RUB',
  timezone: 'UTC',
  seo: {} as Tenant['seo'],
  kitchenUrgencyMinutes: 15,
  kitchenConfig: {
    sourceStatusId: null,
    cookingStatusId: null,
    completedStatusMap: { delivery: null, pickup: null, dine_in: null },
  },
  orderNumberConfig: null,
  maxAddonsDefault: null,
  onboardingCompleted: true,
  onboardingState: emptyOnboardingState(),
  orderSchedulingConfig: {
    enabled: false,
    slotStep: 30,
    daysAhead: 3,
    deliveryLeadMinutes: 60,
    pickupLeadMinutes: 30,
    closeBufferMinutes: 30,
    holdingStatusId: null,
    nextStatusId: null,
  },
  legalInfo: null,
  paymentMethods: ['cash', 'card'],
  createdAt: new Date().toISOString(),
  ...overrides,
})

const tenantRef = ref<Tenant | null>(null)
const isOwnerRef = ref(false)
const updateMock = vi.fn(async (_data: { onboardingState: OnboardingState }) => {})

vi.mock('pinia', () => ({
  storeToRefs: (store: { maybeTenant: unknown; isOwner: unknown; isServices: unknown }) => ({
    maybeTenant: store.maybeTenant,
    isOwner: store.isOwner,
    isServices: store.isServices,
  }),
}))

vi.mock('~/stores/tenant', () => ({
  useTenantStore: () => ({
    maybeTenant: tenantRef,
    isOwner: isOwnerRef,
    isServices: computed(() => tenantRef.value?.businessType === 'services'),
    update: updateMock,
  }),
}))

// Import after mocks
import { useOnboarding } from '../useOnboarding'

describe('useOnboarding', () => {
  beforeEach(() => {
    tenantRef.value = null
    isOwnerRef.value = false
    updateMock.mockClear()
    gateDelivery.value = false
    gatePickup.value = false
    gateDineIn.value = false
    gateReservations.value = false
    gateServices.value = false
  })

  describe('visibility', () => {
    it('false when tenant not loaded', () => {
      expect(useOnboarding().isVisible.value).toBe(false)
    })

    it('false for non-owner', () => {
      tenantRef.value = makeTenant()
      expect(useOnboarding().isVisible.value).toBe(false)
    })

    it('false when dismissedAt set', () => {
      tenantRef.value = makeTenant({
        onboardingState: { ...emptyOnboardingState(), dismissedAt: '2026-01-01' },
      })
      isOwnerRef.value = true
      expect(useOnboarding().isVisible.value).toBe(false)
    })

    it('true for owner with empty state', () => {
      tenantRef.value = makeTenant()
      isOwnerRef.value = true
      expect(useOnboarding().isVisible.value).toBe(true)
    })

    it('stays visible when allCompleted but not dismissed (final screen)', () => {
      tenantRef.value = makeTenant({
        onboardingState: {
          ...emptyOnboardingState(),
          completedAt: '2026-01-01',
        },
      })
      isOwnerRef.value = true
      expect(useOnboarding().isVisible.value).toBe(true)
    })
  })

  describe('linear flow', () => {
    it('first step is active when currentStepId is null', () => {
      tenantRef.value = makeTenant()
      isOwnerRef.value = true
      const { steps, activeStepId } = useOnboarding()

      expect(activeStepId.value).toBe('category')
      expect(steps.value[0].status).toBe('active')
      expect(steps.value[1].status).toBe('locked')
    })

    it('everything before currentStepId is done, everything after is locked', () => {
      tenantRef.value = makeTenant({
        onboardingState: { ...emptyOnboardingState(), currentStepId: 'site' },
      })
      isOwnerRef.value = true
      gateDelivery.value = true
      const { steps, activeStepId } = useOnboarding()

      expect(activeStepId.value).toBe('site')
      const byId = Object.fromEntries(steps.value.map((s) => [s.id, s.status]))

      expect(byId.category).toBe('done')
      expect(byId.item).toBe('done')
      expect(byId['intake-delivery']).toBe('done')
      expect(byId.legal).toBe('done')
      expect(byId.statuses).toBe('done')
      expect(byId.site).toBe('active')
      expect(byId['test-order']).toBe('locked')
    })

    it('falls back to first step when currentStepId is not in flow (flow changed)', () => {
      tenantRef.value = makeTenant({
        onboardingState: { ...emptyOnboardingState(), currentStepId: 'intake-delivery' },
        // delivery module disabled → intake-delivery не во флоу
      })
      isOwnerRef.value = true
      expect(useOnboarding().activeStepId.value).toBe('category')
    })

    it('when completedAt set, all steps are done and no active', () => {
      tenantRef.value = makeTenant({
        onboardingState: { ...emptyOnboardingState(), completedAt: '2026-01-01' },
      })
      isOwnerRef.value = true
      const { steps, activeStepId, allCompleted } = useOnboarding()

      expect(allCompleted.value).toBe(true)
      expect(activeStepId.value).toBeNull()
      expect(steps.value.every((s) => s.status === 'done')).toBe(true)
    })
  })

  describe('module-driven intake steps', () => {
    it('includes one intake step per enabled module, in order', () => {
      tenantRef.value = makeTenant()
      isOwnerRef.value = true
      gateDelivery.value = true
      gateDineIn.value = true
      const ids = useOnboarding().steps.value.map((s) => s.id)

      expect(ids).toEqual(['category', 'item', 'intake-delivery', 'intake-dine-in', 'legal', 'statuses', 'site', 'test-order'])
    })

    it('omits intake, legal, statuses and test-order steps when no intake modules are enabled', () => {
      tenantRef.value = makeTenant()
      isOwnerRef.value = true
      const ids = useOnboarding().steps.value.map((s) => s.id)

      expect(ids).toEqual(['category', 'item', 'site'])
    })

    it('services flow: intake-services, no statuses step, test-order id preserved', () => {
      tenantRef.value = makeTenant({ businessType: 'services' })
      isOwnerRef.value = true
      gateServices.value = true
      const { steps } = useOnboarding()
      const ids = steps.value.map((s) => s.id)

      expect(ids).toEqual(['category', 'item', 'intake-services', 'legal', 'site', 'test-order'])
    })

    it('services flow: last step has booking-specific title', () => {
      tenantRef.value = makeTenant({ businessType: 'services' })
      isOwnerRef.value = true
      gateServices.value = true
      const last = useOnboarding().steps.value.at(-1)!

      expect(last.title).toBe('Проверьте форму записи')
    })

    it('services flow without bookings module: no intake/test-order, no statuses', () => {
      tenantRef.value = makeTenant({ businessType: 'services' })
      isOwnerRef.value = true
      const ids = useOnboarding().steps.value.map((s) => s.id)

      expect(ids).toEqual(['category', 'item', 'site'])
    })

    it('reservations only: includes reservations and legal, no statuses or test-order', () => {
      tenantRef.value = makeTenant()
      isOwnerRef.value = true
      gateReservations.value = true
      const ids = useOnboarding().steps.value.map((s) => s.id)

      expect(ids).toEqual(['category', 'item', 'reservations', 'legal', 'site'])
    })

    it('reservations + delivery: both intake steps present, legal appears once', () => {
      tenantRef.value = makeTenant()
      isOwnerRef.value = true
      gateDelivery.value = true
      gateReservations.value = true
      const ids = useOnboarding().steps.value.map((s) => s.id)

      expect(ids).toEqual(['category', 'item', 'intake-delivery', 'reservations', 'legal', 'statuses', 'site', 'test-order'])
    })

    it('services flow ignores reservations gate', () => {
      tenantRef.value = makeTenant({ businessType: 'services' })
      isOwnerRef.value = true
      gateReservations.value = true
      gateServices.value = true
      const ids = useOnboarding().steps.value.map((s) => s.id)

      expect(ids).toEqual(['category', 'item', 'intake-services', 'legal', 'site', 'test-order'])
    })
  })

  describe('progress', () => {
    it('counts steps before currentStepId as completed', () => {
      // delivery enabled → flow: category, item, intake-delivery, legal, statuses, site, test-order (7 steps)
      // statuses is index 4 → completed = 4
      tenantRef.value = makeTenant({
        onboardingState: { ...emptyOnboardingState(), currentStepId: 'statuses' },
      })
      isOwnerRef.value = true
      gateDelivery.value = true
      const { progress } = useOnboarding()

      expect(progress.value.completed).toBe(4)
      expect(progress.value.total).toBe(7)
    })

    it('counts all as completed when completedAt set', () => {
      // no modules → flow: category, item, site (3 steps)
      tenantRef.value = makeTenant({
        onboardingState: { ...emptyOnboardingState(), completedAt: '2026-01-01' },
      })
      isOwnerRef.value = true
      const { progress } = useOnboarding()

      expect(progress.value.completed).toBe(3)
      expect(progress.value.total).toBe(3)
    })
  })

  describe('completeStep', () => {
    it('advances currentStepId to the next step', async () => {
      tenantRef.value = makeTenant()
      isOwnerRef.value = true
      await useOnboarding().completeStep('category')
      expect(updateMock).toHaveBeenCalledTimes(1)
      expect(updateMock.mock.calls[0][0].onboardingState.currentStepId).toBe('item')
      expect(updateMock.mock.calls[0][0].onboardingState.completedAt).toBeNull()
    })

    it('sets completedAt when advancing past the last step', async () => {
      // no modules → last step is 'site'
      tenantRef.value = makeTenant({
        onboardingState: { ...emptyOnboardingState(), currentStepId: 'site' },
      })
      isOwnerRef.value = true
      await useOnboarding().completeStep('site')
      const arg = updateMock.mock.calls[0][0].onboardingState

      expect(arg.currentStepId).toBeNull()
      expect(arg.completedAt).toEqual(expect.any(String))
      expect(arg.dismissedAt).toBeNull()
    })

    it('ignores unknown step ids', async () => {
      tenantRef.value = makeTenant()
      isOwnerRef.value = true
      await useOnboarding().completeStep('nonexistent')
      expect(updateMock).not.toHaveBeenCalled()
    })
  })

  describe('dismiss / finish / reset', () => {
    it('dismiss writes dismissedAt only', async () => {
      tenantRef.value = makeTenant()
      isOwnerRef.value = true
      await useOnboarding().dismiss()
      const arg = updateMock.mock.calls[0][0].onboardingState

      expect(arg.dismissedAt).toEqual(expect.any(String))
      expect(arg.completedAt).toBeNull()
    })

    it('finish writes both completedAt and dismissedAt', async () => {
      tenantRef.value = makeTenant()
      isOwnerRef.value = true
      await useOnboarding().finish()
      const arg = updateMock.mock.calls[0][0].onboardingState

      expect(arg.completedAt).toEqual(expect.any(String))
      expect(arg.dismissedAt).toEqual(expect.any(String))
    })

    it('finish preserves existing completedAt', async () => {
      tenantRef.value = makeTenant({
        onboardingState: { ...emptyOnboardingState(), completedAt: '2026-01-01T00:00:00.000Z' },
      })
      isOwnerRef.value = true
      await useOnboarding().finish()
      expect(updateMock.mock.calls[0][0].onboardingState.completedAt).toBe('2026-01-01T00:00:00.000Z')
    })

    it('reset clears state', async () => {
      tenantRef.value = makeTenant({
        onboardingState: { ...emptyOnboardingState(), currentStepId: 'site' },
      })
      isOwnerRef.value = true
      await useOnboarding().reset()
      const arg = updateMock.mock.calls[0][0].onboardingState

      expect(arg.currentStepId).toBeNull()
      expect(arg.completedAt).toBeNull()
      expect(arg.dismissedAt).toBeNull()
    })
  })
})
