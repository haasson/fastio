import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'
import { useBranchLimit } from '../plan/useBranchLimit'

const mockBranchesMax = ref(0)
const mockCanAddBranch = ref(true)

vi.mock('../plan/useAccess', () => ({
  useAccess: () => ({
    branchesMax: computed(() => mockBranchesMax.value),
    canAddBranch: computed(() => mockCanAddBranch.value),
  }),
}))

const setup = (max: number, count: number) => {
  mockBranchesMax.value = max
  mockCanAddBranch.value = max === 0 || count < max
}

describe('useBranchLimit', () => {
  describe('maxBranches', () => {
    it('возвращает 0 (безлимит)', () => {
      setup(0, 0)
      expect(useBranchLimit().maxBranches.value).toBe(0)
    })

    it('возвращает лимит из плана', () => {
      setup(3, 0)
      expect(useBranchLimit().maxBranches.value).toBe(3)
    })
  })

  describe('canAddBranch', () => {
    it('max=0 → безлимит → true', () => {
      setup(0, 100)
      expect(useBranchLimit().canAddBranch.value).toBe(true)
    })

    it('меньше лимита → можно добавить', () => {
      setup(3, 2)
      expect(useBranchLimit().canAddBranch.value).toBe(true)
    })

    it('достигнут лимит → нельзя добавить', () => {
      setup(3, 3)
      expect(useBranchLimit().canAddBranch.value).toBe(false)
    })

    it('превышен лимит → нельзя добавить', () => {
      setup(3, 5)
      expect(useBranchLimit().canAddBranch.value).toBe(false)
    })
  })

  describe('branchLimitReached', () => {
    it('обратен canAddBranch', () => {
      setup(1, 0)
      expect(useBranchLimit().branchLimitReached.value).toBe(false)
      mockCanAddBranch.value = false
      expect(useBranchLimit().branchLimitReached.value).toBe(true)
    })
  })

  describe('branchLimitLabel', () => {
    it('1 → "филиал"', () => {
      setup(1, 0)
      expect(useBranchLimit().branchLimitLabel.value).toBe('филиал')
    })

    it('3 → "филиала"', () => {
      setup(3, 0)
      expect(useBranchLimit().branchLimitLabel.value).toBe('филиала')
    })

    it('5 → "филиалов"', () => {
      setup(5, 0)
      expect(useBranchLimit().branchLimitLabel.value).toBe('филиалов')
    })
  })
})
