import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'
import { useBranchLimit } from '../plan/useBranchLimit'
import type { Plan } from '@fastio/shared'

const mockPlan = ref('start')
const mockPlans = ref<Plan[]>([])
const mockBranches = ref<unknown[]>([])

vi.mock('../plan/usePlanFeatures', () => ({
  usePlanFeatures: () => ({ plan: computed(() => mockPlan.value) }),
}))

vi.mock('../plan/usePlans', () => ({
  usePlans: () => ({ plans: mockPlans }),
}))

vi.mock('~/stores/branch', () => ({
  useBranchStore: () => ({ branches: mockBranches.value }),
}))

const setPlans = (plans: Plan[]) => {
  mockPlans.value = plans
}
const setBranches = (count: number) => {
  mockBranches.value = Array(count).fill({})
}

describe('useBranchLimit', () => {
  describe('maxBranches', () => {
    it('план не найден → 0', () => {
      setPlans([])
      mockPlan.value = 'start'
      expect(useBranchLimit().maxBranches.value).toBe(0)
    })

    it('возвращает maxBranches текущего плана', () => {
      setPlans([{ id: '1', key: 'business', name: 'Business', sortOrder: 1, maxBranches: 3 }])
      mockPlan.value = 'business'
      expect(useBranchLimit().maxBranches.value).toBe(3)
    })
  })

  describe('canAddBranch', () => {
    it('maxBranches=0 → безлимит → всегда true', () => {
      setPlans([{ id: '1', key: 'pro', name: 'Pro', sortOrder: 2, maxBranches: 0 }])
      mockPlan.value = 'pro'
      setBranches(100)
      expect(useBranchLimit().canAddBranch.value).toBe(true)
    })

    it('меньше лимита → можно добавить', () => {
      setPlans([{ id: '1', key: 'business', name: 'Business', sortOrder: 1, maxBranches: 3 }])
      mockPlan.value = 'business'
      setBranches(2)
      expect(useBranchLimit().canAddBranch.value).toBe(true)
    })

    it('достигнут лимит → нельзя добавить', () => {
      setPlans([{ id: '1', key: 'business', name: 'Business', sortOrder: 1, maxBranches: 3 }])
      mockPlan.value = 'business'
      setBranches(3)
      expect(useBranchLimit().canAddBranch.value).toBe(false)
    })

    it('превышен лимит → нельзя добавить', () => {
      setPlans([{ id: '1', key: 'business', name: 'Business', sortOrder: 1, maxBranches: 3 }])
      mockPlan.value = 'business'
      setBranches(5)
      expect(useBranchLimit().canAddBranch.value).toBe(false)
    })
  })

  describe('branchLimitReached', () => {
    it('обратен canAddBranch', () => {
      setPlans([{ id: '1', key: 'business', name: 'Business', sortOrder: 1, maxBranches: 1 }])
      mockPlan.value = 'business'
      setBranches(0)
      expect(useBranchLimit().branchLimitReached.value).toBe(false)
      setBranches(1)
      expect(useBranchLimit().branchLimitReached.value).toBe(true)
    })
  })

  describe('branchLimitLabel', () => {
    it('1 → "филиал"', () => {
      setPlans([{ id: '1', key: 'start', name: 'Start', sortOrder: 0, maxBranches: 1 }])
      mockPlan.value = 'start'
      expect(useBranchLimit().branchLimitLabel.value).toBe('филиал')
    })

    it('3 → "филиала"', () => {
      setPlans([{ id: '1', key: 'business', name: 'Business', sortOrder: 1, maxBranches: 3 }])
      mockPlan.value = 'business'
      expect(useBranchLimit().branchLimitLabel.value).toBe('филиала')
    })

    it('5 → "филиалов"', () => {
      setPlans([{ id: '1', key: 'pro', name: 'Pro', sortOrder: 2, maxBranches: 5 }])
      mockPlan.value = 'pro'
      expect(useBranchLimit().branchLimitLabel.value).toBe('филиалов')
    })
  })
})
