import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OrderStatus, OrderStatusGroup } from '@fastio/shared'
import { useKitchenStatusBlock } from '../kitchen/useKitchenStatusBlock'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCountActive = vi.fn<() => Promise<number>>()
const mockConfirm = vi.fn<() => Promise<boolean | null>>()

const mockTenant: {
  modules: { kitchen: boolean }
  kitchenConfig: {
    sourceStatusId: string | null
    cookingStatusId: string | null
    completedStatusMap: { delivery: string | null; pickup: string | null; dine_in: string | null }
  } | null
} = {
  modules: { kitchen: false },
  kitchenConfig: null,
}

vi.mock('~/composables/data/useDatabase', () => ({
  useDatabase: () => ({
    kitchenQueue: { countActiveForOrder: mockCountActive },
  }),
}))

vi.mock('~/stores/tenant', () => ({
  useTenantStore: () => ({ tenant: mockTenant }),
}))

vi.mock('@fastio/kit', () => ({
  useConfirm: () => ({ confirm: mockConfirm }),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_IDS = {
  new: 'status-new',
  accepted: 'status-accepted',
  cooking: 'status-cooking',
  readyDelivery: 'status-ready-delivery',
  readyPickup: 'status-ready-pickup',
  readyDineIn: 'status-ready-dinein',
  cancelled: 'status-cancelled',
  completed: 'status-completed',
}

const makeStatus = (id: string, groupType: OrderStatusGroup): OrderStatus => ({
  id,
  tenantId: 't1',
  name: id,
  groupType,
  position: 0,
  quickActions: [],
})

const KITCHEN_CONFIG = {
  sourceStatusId: STATUS_IDS.accepted,
  cookingStatusId: STATUS_IDS.cooking,
  completedStatusMap: {
    delivery: STATUS_IDS.readyDelivery,
    pickup: STATUS_IDS.readyPickup,
    dine_in: STATUS_IDS.readyDineIn,
  },
}

const enableKitchen = () => {
  mockTenant.modules.kitchen = true
  mockTenant.kitchenConfig = { ...KITCHEN_CONFIG }
}

const disableKitchen = () => {
  mockTenant.modules.kitchen = false
  mockTenant.kitchenConfig = null
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useKitchenStatusBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    disableKitchen()
    mockConfirm.mockResolvedValue(false)
    mockCountActive.mockResolvedValue(0)
  })

  describe('kitchen disabled', () => {
    it('allows any status change when kitchen module is off', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()

      const result = await checkKitchenBlock(
        'order-1',
        STATUS_IDS.cooking,
        makeStatus(STATUS_IDS.accepted, 'in_progress'),
      )

      expect(result.blocked).toBe(false)
      expect(mockConfirm).not.toHaveBeenCalled()
      expect(mockCountActive).not.toHaveBeenCalled()
    })

    it('allows any status change when kitchenConfig has no sourceStatusId', async () => {
      mockTenant.modules.kitchen = true
      mockTenant.kitchenConfig = {
        sourceStatusId: null,
        cookingStatusId: null,
        completedStatusMap: { delivery: null, pickup: null, dine_in: null },
      }

      const { checkKitchenBlock } = useKitchenStatusBlock()

      const result = await checkKitchenBlock(
        'order-1',
        STATUS_IDS.cooking,
        makeStatus(STATUS_IDS.accepted, 'in_progress'),
      )

      expect(result.blocked).toBe(false)
    })
  })

  describe('kitchen enabled — cancel always allowed', () => {
    it('allows transition to cancelled from any status', async () => {
      enableKitchen()
      mockCountActive.mockResolvedValue(5)

      const { checkKitchenBlock } = useKitchenStatusBlock()

      const result = await checkKitchenBlock(
        'order-1',
        STATUS_IDS.cooking,
        makeStatus(STATUS_IDS.cancelled, 'cancelled'),
      )

      expect(result.blocked).toBe(false)
      expect(mockConfirm).not.toHaveBeenCalled()
    })
  })

  describe('kitchen enabled — kitchen-controlled statuses', () => {
    beforeEach(enableKitchen)

    it('blocks from cookingStatusId to in_progress', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()

      const result = await checkKitchenBlock(
        'order-1',
        STATUS_IDS.cooking,
        makeStatus(STATUS_IDS.accepted, 'in_progress'),
      )

      expect(result.blocked).toBe(true)
      expect(mockConfirm).toHaveBeenCalledOnce()
      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Статус управляется кухней',
        confirmText: false,
        cancelText: 'Понятно',
      }))
    })

    it('blocks from cookingStatusId to new', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()

      const result = await checkKitchenBlock(
        'order-1',
        STATUS_IDS.cooking,
        makeStatus(STATUS_IDS.new, 'new'),
      )

      expect(result.blocked).toBe(true)
      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Заказ на кухне',
      }))
    })

    it('blocks from completedStatusMap.delivery', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()

      const result = await checkKitchenBlock(
        'order-1',
        STATUS_IDS.readyDelivery,
        makeStatus(STATUS_IDS.accepted, 'in_progress'),
      )

      expect(result.blocked).toBe(true)
    })

    it('blocks from completedStatusMap.pickup', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()

      const result = await checkKitchenBlock(
        'order-1',
        STATUS_IDS.readyPickup,
        makeStatus(STATUS_IDS.accepted, 'in_progress'),
      )

      expect(result.blocked).toBe(true)
    })

    it('blocks from completedStatusMap.dine_in', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()

      const result = await checkKitchenBlock(
        'order-1',
        STATUS_IDS.readyDineIn,
        makeStatus(STATUS_IDS.accepted, 'in_progress'),
      )

      expect(result.blocked).toBe(true)
    })

    it('does not query DB when status is kitchen-controlled', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()

      await checkKitchenBlock(
        'order-1',
        STATUS_IDS.cooking,
        makeStatus(STATUS_IDS.accepted, 'in_progress'),
      )

      expect(mockCountActive).not.toHaveBeenCalled()
    })

    it('shows correct message for completed target group', async () => {
      const { checkKitchenBlock } = useKitchenStatusBlock()

      await checkKitchenBlock(
        'order-1',
        STATUS_IDS.cooking,
        makeStatus(STATUS_IDS.completed, 'completed'),
      )

      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Статус управляется кухней',
        message: expect.stringContaining('после завершения всех блюд'),
      }))
    })
  })

  describe('kitchen enabled — active queue items', () => {
    beforeEach(enableKitchen)

    it('blocks when order has active kitchen items', async () => {
      mockCountActive.mockResolvedValue(3)

      const { checkKitchenBlock } = useKitchenStatusBlock()

      const result = await checkKitchenBlock(
        'order-1',
        STATUS_IDS.accepted,
        makeStatus(STATUS_IDS.new, 'new'),
      )

      expect(result.blocked).toBe(true)
      expect(mockCountActive).toHaveBeenCalledWith('order-1')
      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('3 шт'),
      }))
    })

    it('allows when order has no active kitchen items and status is not kitchen-controlled', async () => {
      mockCountActive.mockResolvedValue(0)

      const { checkKitchenBlock } = useKitchenStatusBlock()

      const result = await checkKitchenBlock(
        'order-1',
        STATUS_IDS.accepted,
        makeStatus(STATUS_IDS.new, 'new'),
      )

      expect(result.blocked).toBe(false)
      expect(mockConfirm).not.toHaveBeenCalled()
    })

    it('shows active count in in_progress message', async () => {
      mockCountActive.mockResolvedValue(5)

      const { checkKitchenBlock } = useKitchenStatusBlock()

      await checkKitchenBlock(
        'order-1',
        STATUS_IDS.accepted,
        makeStatus('other-in-progress', 'in_progress'),
      )

      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Статус управляется кухней',
        message: expect.stringContaining('5 блюд'),
      }))
    })
  })
})
