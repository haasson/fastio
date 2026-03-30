import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePlans } from '../plan/usePlans'
import type { Plan } from '@fastio/shared'

const mockPlansList = vi.fn<() => Promise<Plan[]>>()

vi.mock('~/composables/data/useDatabase', () => ({
  useDatabase: () => ({
    plans: { list: mockPlansList },
  }),
}))

const TEST_PLANS: Plan[] = [
  { id: '1', key: 'start', name: 'Start', description: '', price: 0, isActive: true, sortOrder: 0, maxBranches: 1 },
  { id: '2', key: 'business', name: 'Business', description: '', price: 0, isActive: true, sortOrder: 1, maxBranches: 3 },
  { id: '3', key: 'pro', name: 'Pro', description: '', price: 0, isActive: true, sortOrder: 2, maxBranches: 0 },
]

describe('usePlans', () => {
  beforeEach(() => {
    const { invalidate, plans } = usePlans()

    invalidate()
    plans.value = []
    mockPlansList.mockClear()
    mockPlansList.mockResolvedValue(TEST_PLANS)
  })

  describe('getPlanSortOrder — до загрузки', () => {
    it('start → 0 (безопасный дефолт)', () => {
      const { getPlanSortOrder } = usePlans()

      expect(getPlanSortOrder('start')).toBe(0)
    })

    it('business → Infinity (всё залочено до загрузки)', () => {
      const { getPlanSortOrder } = usePlans()

      expect(getPlanSortOrder('business')).toBe(Infinity)
    })

    it('pro → Infinity', () => {
      const { getPlanSortOrder } = usePlans()

      expect(getPlanSortOrder('pro')).toBe(Infinity)
    })
  })

  describe('getPlanSortOrder — после загрузки', () => {
    it('возвращает sortOrder из загруженных планов', async () => {
      const { load, getPlanSortOrder } = usePlans()

      await load()
      expect(getPlanSortOrder('start')).toBe(0)
      expect(getPlanSortOrder('business')).toBe(1)
      expect(getPlanSortOrder('pro')).toBe(2)
    })

    it('неизвестный ключ → 0', async () => {
      const { load, getPlanSortOrder } = usePlans()

      await load()
      expect(getPlanSortOrder('enterprise')).toBe(0)
    })
  })

  describe('getPlanLabel', () => {
    it('до загрузки → возвращает ключ как есть', () => {
      const { getPlanLabel } = usePlans()

      expect(getPlanLabel('business')).toBe('business')
    })

    it('после загрузки → возвращает name плана', async () => {
      const { load, getPlanLabel } = usePlans()

      await load()
      expect(getPlanLabel('start')).toBe('Start')
      expect(getPlanLabel('business')).toBe('Business')
      expect(getPlanLabel('pro')).toBe('Pro')
    })

    it('неизвестный ключ → возвращает ключ', async () => {
      const { load, getPlanLabel } = usePlans()

      await load()
      expect(getPlanLabel('unknown')).toBe('unknown')
    })
  })

  describe('load', () => {
    it('повторный вызов не дёргает API дважды', async () => {
      const { load } = usePlans()

      await load()
      await load()
      expect(mockPlansList).toHaveBeenCalledTimes(1)
    })

    it('invalidate сбрасывает кэш', async () => {
      const { load, invalidate } = usePlans()

      await load()
      invalidate()
      await load()
      expect(mockPlansList).toHaveBeenCalledTimes(2)
    })
  })
})
