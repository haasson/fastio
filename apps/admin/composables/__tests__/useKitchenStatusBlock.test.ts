import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Order } from '@fastio/shared'
import { useKitchenStatusBlock } from '../kitchen/useKitchenStatusBlock'

const mockConfirm = vi.fn<() => Promise<boolean | null>>()

const mockTenant: {
  modules: { kitchen: boolean }
  kitchenConfig: { sourceStatusId: string | null } | null
} = {
  modules: { kitchen: false },
  kitchenConfig: null,
}

vi.mock('~/stores/tenant', () => ({
  useTenantStore: () => ({ tenant: mockTenant }),
}))

vi.mock('@fastio/kit', () => ({
  useConfirm: () => ({ confirm: mockConfirm }),
}))

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
  tenantId: 't1',
  customerName: null,
  customerPhone: '',
  customerEmail: null,
  items: [],
  deliveryType: 'delivery',
  address: null,
  entrance: null,
  floor: null,
  apartment: null,
  intercom: null,
  deliveryLat: null,
  deliveryLon: null,
  comment: null,
  promoCode: null,
  discountAmount: 0,
  subtotal: 0,
  deliveryFee: 0,
  total: 0,
  status: 'status-1',
  statusGroup: 'in_progress',
  statusName: null,
  paymentType: 'cash',
  branchId: null,
  branchAddress: null,
  deliveryZoneId: null,
  tableId: null,
  tableName: null,
  orderNumber: null,
  acceptedBy: null,
  createdAt: '',
  updatedAt: '',
  kitchenQueuedAt: null,
  kitchenCompletedAt: null,
  visitedStatuses: [],
  ...overrides,
})

const enableKitchen = () => {
  mockTenant.modules.kitchen = true
  mockTenant.kitchenConfig = { sourceStatusId: 'status-accepted' }
}

describe('useKitchenStatusBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTenant.modules.kitchen = false
    mockTenant.kitchenConfig = null
    mockConfirm.mockResolvedValue(false)
  })

  describe('kitchen disabled', () => {
    it('allows any change when kitchen module is off', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(makeOrder({ kitchenQueuedAt: '2026-01-01' }), 'in_progress')

      expect(result.blocked).toBe(false)
    })

    it('allows any change when sourceStatusId is not configured', async () => {
      mockTenant.modules.kitchen = true
      mockTenant.kitchenConfig = { sourceStatusId: null }
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(makeOrder({ kitchenQueuedAt: '2026-01-01' }), 'in_progress')

      expect(result.blocked).toBe(false)
    })
  })

  describe('cancel always allowed', () => {
    it('allows cancel even when order is on kitchen', async () => {
      enableKitchen()
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(
        makeOrder({ kitchenQueuedAt: '2026-01-01' }),
        'cancelled',
      )

      expect(result.blocked).toBe(false)
      expect(mockConfirm).not.toHaveBeenCalled()
    })
  })

  describe('dine_in never blocked', () => {
    it('allows any change for dine_in orders', async () => {
      enableKitchen()
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(
        makeOrder({ deliveryType: 'dine_in', kitchenQueuedAt: '2026-01-01' }),
        'in_progress',
      )

      expect(result.blocked).toBe(false)
    })
  })

  describe('order on kitchen (queued, not completed)', () => {
    beforeEach(enableKitchen)

    it('blocks manual status change', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(
        makeOrder({ kitchenQueuedAt: '2026-01-01' }),
        'in_progress',
      )

      expect(result.blocked).toBe(true)
      expect(mockConfirm).toHaveBeenCalledOnce()
      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Заказ на кухне',
        confirmText: false,
        cancelText: 'Понятно',
      }))
    })

    it('blocks moving to new', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(
        makeOrder({ kitchenQueuedAt: '2026-01-01' }),
        'new',
      )

      expect(result.blocked).toBe(true)
    })

    it('blocks moving to completed', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(
        makeOrder({ kitchenQueuedAt: '2026-01-01' }),
        'completed',
      )

      expect(result.blocked).toBe(true)
    })
  })

  describe('order passed kitchen (both flags set)', () => {
    beforeEach(enableKitchen)

    it('allows any status change', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(
        makeOrder({ kitchenQueuedAt: '2026-01-01', kitchenCompletedAt: '2026-01-01' }),
        'in_progress',
      )

      expect(result.blocked).toBe(false)
      expect(mockConfirm).not.toHaveBeenCalled()
    })

    it('allows moving to completed', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(
        makeOrder({ kitchenQueuedAt: '2026-01-01', kitchenCompletedAt: '2026-01-01' }),
        'completed',
      )

      expect(result.blocked).toBe(false)
    })

    it('allows moving back to new', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(
        makeOrder({ kitchenQueuedAt: '2026-01-01', kitchenCompletedAt: '2026-01-01' }),
        'new',
      )

      expect(result.blocked).toBe(false)
    })
  })

  describe('order never went to kitchen', () => {
    beforeEach(enableKitchen)

    it('allows any change when kitchenQueuedAt is null', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(makeOrder(), 'in_progress')

      expect(result.blocked).toBe(false)
    })
  })

  describe('pickup orders', () => {
    beforeEach(enableKitchen)

    it('blocks pickup order on kitchen', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(
        makeOrder({ deliveryType: 'pickup', kitchenQueuedAt: '2026-01-01' }),
        'in_progress',
      )

      expect(result.blocked).toBe(true)
    })

    it('allows pickup order after kitchen', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()
      const result = await checkKitchenBlock(
        makeOrder({ deliveryType: 'pickup', kitchenQueuedAt: '2026-01-01', kitchenCompletedAt: '2026-01-01' }),
        'in_progress',
      )

      expect(result.blocked).toBe(false)
    })
  })
})
